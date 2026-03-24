const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.database();

// Store webhook URL in Realtime Database (set this via the app)
// The app saves it to localStorage, but you need to also save it to Firebase
// For production, modify the app to save webhookUrl to Firebase at: /config/webhookUrl

exports.onTweetCreated = functions.database.ref('/tweets/{tweetId}')
    .onCreate(async (snapshot, context) => {
        const tweet = snapshot.val();
        const tweetId = context.params.tweetId;
        
        // Get webhook URL from config
        const configSnap = await db.ref('/config/webhookUrl').once('value');
        const webhookUrl = configSnap.val();
        
        if (!webhookUrl) return null;
        
        // Get user info
        const userSnap = await db.ref(`/users/${tweet.uid}`).once('value');
        const user = userSnap.val() || { username: 'unknown', profilePicUrl: null };
        
        const postUrl = `https://your-app.web.app/?post=${tweetId}`;
        const formattedHandle = `@${user.username}`;
        
        let title = tweet.isRetweet ? `🔁 Retweet by ${formattedHandle}` : `🕊️ New post from ${formattedHandle}`;
        let description = tweet.content || "No text content";
        
        if (tweet.isRetweet) {
            description = `${formattedHandle} retweeted @${tweet.originalAuthor}\n\nOriginal: "${tweet.originalContent?.substring(0, 150) || ""}"`;
            if (tweet.content) description += `\n\nComment: "${tweet.content}"`;
        }
        
        const embed = {
            title: title,
            url: postUrl,
            color: tweet.isRetweet ? 0x00BA7C : 0x1D9BF0,
            timestamp: new Date().toISOString(),
            author: {
                name: formattedHandle,
                icon_url: user.profilePicUrl || `https://ui-avatars.com/api/?background=1D9BF0&color=fff&bold=true&name=${user.username?.charAt(0) || 'U'}`
            },
            footer: {
                text: "Made by Hyawii • Twitter (24/7)",
                icon_url: "https://cdn-icons-png.flaticon.com/512/733/733579.png"
            },
            fields: [
                { name: "📝 Content", value: description.substring(0, 1024), inline: false },
                { name: "🔗 View Post", value: `[Click to open](${postUrl})`, inline: false }
            ]
        };
        
        if (tweet.imageUrl) {
            embed.image = { url: tweet.imageUrl };
        }
        
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
            console.log(`Webhook sent for tweet ${tweetId}`);
        } catch (error) {
            console.error('Webhook error:', error);
        }
        
        return null;
    });

exports.onCommentCreated = functions.database.ref('/comments/{tweetId}/{commentId}')
    .onCreate(async (snapshot, context) => {
        const comment = snapshot.val();
        const tweetId = context.params.tweetId;
        
        const configSnap = await db.ref('/config/webhookUrl').once('value');
        const webhookUrl = configSnap.val();
        if (!webhookUrl) return null;
        
        const userSnap = await db.ref(`/users/${comment.uid}`).once('value');
        const user = userSnap.val() || { username: 'unknown', profilePicUrl: null };
        
        const tweetSnap = await db.ref(`/tweets/${tweetId}`).once('value');
        const originalTweet = tweetSnap.val();
        const originalAuthorSnap = await db.ref(`/users/${originalTweet?.uid}`).once('value');
        const originalAuthor = originalAuthorSnap.val()?.username || 'unknown';
        
        const postUrl = `https://your-app.web.app/?post=${tweetId}`;
        
        const embed = {
            title: `💬 Reply from @${user.username}`,
            url: postUrl,
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
            author: {
                name: `@${user.username}`,
                icon_url: user.profilePicUrl || `https://ui-avatars.com/api/?background=1D9BF0&color=fff&bold=true&name=${user.username?.charAt(0) || 'U'}`
            },
            footer: { text: "Made by Hyawii • Twitter (24/7)" },
            fields: [
                { name: "Replying to", value: `@${originalAuthor}`, inline: false },
                { name: "Original post", value: originalTweet?.content?.substring(0, 200) || "", inline: false },
                { name: "Reply", value: comment.text, inline: false },
                { name: "🔗 View", value: `[Click to open](${postUrl})`, inline: false }
            ]
        };
        
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (error) {
            console.error('Webhook error:', error);
        }
        
        return null;
    });
