// Import twitter library
const Twitter = require("twitter-v2");
const Twit = require("twit");
const fs = require('fs');

// Import twitter account credentials
const creds = require("./config");
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");

async function main() {

    // CONSTANTS/BOT SETTINGS
    /////////////////////////////
    // Hashtags to scrape
    const hashtags = [
        "#occmed",
        "#occenvmed"
    ];

    // Number of latest results to choose from (range 10 - 100 inclusive)
    const numTweets = 10;

    // Blacklisted users (spam, etc) (format as "@handle" with @ removed)
    const blacklist = [
        "doctorsdilemma",
    ]
    
    // Allow bot to retweet retweets and/or replies
    const allowRetweets = false; // Uses Twitter API v2 for querying
    const allowReplies = false; // Uses Twitter API v1 for retweeting
    /////////////////////////////

    // Authenticate new Twitter clients
    const searchClient = new Twitter(creds.twitter);
    const retweetClient = new Twit(creds.twit);


    ////// Query


    // Build query
    const hashtagString = "("+ hashtags.join(" OR ") + ")";
    const retweets = (!allowRetweets?" -is:retweet":"");
    const replies = (!allowReplies?"  -is:reply":"");

    // Make GET Request for tweet data
    let {data: tweets, includes, meta, errors } = await searchClient.get("tweets/search/recent", {
        query: hashtagString + retweets + replies + " lang:en",
        max_results: numTweets,
        tweet: {
            fields: [
                "created_at",
            ],
        },
        expansions: 'author_id',
        user: {
            fields: [
                'username',
                'name'
            ],
        },
    });

    // Check for errors
    if (errors) {
        console.log('Errors:', errors);
    }

    // Print data
    // console.log(tweets);
    // console.log(includes);
    // console.log(meta);


    ////// Filter


    // Check for blacklisted users
    let users = includes.users;
    let userId;
    for (let i = 0; i < blacklist.length; i++) {
        for (let j = 0; j < users.length; j++) {
            if (blacklist[i] === users[j].username) {
                // Blacklisted username found, save id  
                userId = users[j].id;

                // Remove corresponding tweet(s)
                for (let k = 0; k < tweets.length; k++) {
                    if (userId === tweets[k].author_id) {
                        tweets.splice(k, 1);
                    }
                }
                
                // Remove userId
                users.splice(j,1);
                
                break;
            }
        }
    }
        

    ////// Cache Compare
    let history = JSON.parse(fs.readFileSync('./history.json', 'utf8'));

    if (history === undefined) {
        history = [];
    }

    // Pick a random tweet
    let randomNum;
    let tweetId;
    let retry = false;
    do {
        retry = false;
        randomNum = Math.floor(Math.random() * tweets.length);
        tweetId = tweets[randomNum].id;
        
        // console.log(randomNum);
        // console.log(tweetId);

        for (let i = 0; i < history.length; i++) {
            if (history[i].id === tweetId) {
                retry = true;
                break;
            }

        }
    } while (retry);


    ////// Retweet


    retweetClient.post('statuses/retweet/:tweetId', {tweetId: tweetId}, (err, data, res) => {
        //console.log(res);
        //console.log(data);
        //console.log(err);
    });
    

    ////// Cache Store
    history.push(tweets[randomNum]);
    const json = JSON.stringify(history, null, 2);
    fs.writeFileSync('./history.json', json, err => {
        if (err) {
            console.log('Error writing to file', err)
        }
    })

    
    ////// Repeat
    // TODO: put on a sleep/time delay 


}

if (require.main === module) {
    main().catch((err) => {
        console.log(err);
        process.exit(1);
    });
}

