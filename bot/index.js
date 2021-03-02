// Import twitter library
const Twitter = require("twitter-v2");
const Twit = require("twit");
const fs = require('fs');

// Use environment vars
const dotenv = require("dotenv");
dotenv.config();

// Sleep Function for time delay
function sleep(duration) {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve()
		}, duration * 1000)
	})
}

async function main() {


    // CONSTANTS/BOT SETTINGS
    /////////////////////////////
    // Hashtags to track (format as "#hashtag")
    const hashtags = [
        "#occmed",
        "#occenvmed",
        "#OEM",
        "#occupationalmedicine",
        "#occupationalhealth",
    ];

    // Greenlisted users to follow (not implemented)
    const greenlist = [
    ];

    // Blacklisted users (spammers, etc) (format as "@handle")
    const blacklist = [
        "@MDJobSite",
        "@DoctorJobsUSA",
    ];

    // Number of retweets to make
    const numRetweets = 1;

    // Number of latest results to retrieve from twitter (range 10 - 100 inclusive)
    const numTweets = 10;

    // Time delay between retweets
    const delaySeconds = 30;

    // Allow bot to retweet retweets and/or replies
    const allowRetweets = false; // Uses Twitter API v2 for querying
    const allowReplies = false; // Uses Twitter API v1 for retweeting
    /////////////////////////////


    // Authenticate new Twitter clients
    const searchClient = new Twitter({consumer_key: process.env.CONSUMER_KEY, consumer_secret: process.env.CONSUMER_SECRET});
    const retweetClient = new Twit({consumer_key: process.env.CONSUMER_KEY, consumer_secret: process.env.CONSUMER_SECRET, 
                                    access_token: process.env.ACCESS_TOKEN, access_token_secret: process.env.ACCESS_TOKEN_SECRET});

    ////// Query

    // Build query
    const hashtagString = "("+ hashtags.join(" OR ") + ")";
    const retweets = (!allowRetweets?" -is:retweet":"");
    const replies = (!allowReplies?" -is:reply":"");

    const fullQuery = hashtagString + retweets + replies + " lang:en";
    console.log(fullQuery);

    // Make GET Request for tweet data
    let {data: tweets, includes, meta, errors } = await searchClient.get("tweets/search/recent", {
        query: fullQuery,
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
        throw errors;
    }

    // Print data
     console.log(tweets);
    // console.log(includes);
    // console.log(meta);

    ////// Filter

    // Remove @
    for (let i = 0; i < blacklist.length; i++) {
        blacklist[i] = blacklist[i].slice(1);
    }

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
        
    ////// Cache Compare: Pull retweeted history
    let history = fs.readFileSync('./history.json', 'utf8');
    
    if (!history) {
        history = {};
    } else {
        history = JSON.parse(history);
    }
    
    // Retweet the desired number of tweets
    let failed = false;
    for (let i = 0; i < numRetweets; i++) {
        // Pick a random tweet
        let randomNum;
        let tweetId;
        let retry = false;
        const maxRetries = 50;
        let attempt = 1;

        // Pick a tweet that hasnt already been retweeted
        do {
            retry = false;
            randomNum = Math.floor(Math.random() * tweets.length);
            tweetId = tweets[randomNum].id;
            
            // console.log(randomNum);
            console.log(tweetId);

            if (tweetId in history && attempt != maxRetries) {
                retry = true;
                break;
            }

            attempt++;
        } while (retry);

        // A new tweet couldnt be found
        if (attempt >= maxRetries) {
            failed = true;
            console.log("No new tweets found to retweet. Exiting");
            break;
        }


        ////// Retweet
        retweetClient.post('statuses/retweet/:tweetId', {tweetId: tweetId}, (err, data, res) => {
            //console.log(res);
            //console.log(data);
            if (err) {
                console.log(err);
                // If status code 403, already retweeted tweet.
                if (err.statusCode == 403) {
                    i--;
                    continue;
                }
                throw err;
            }
        });
        
        ////// Cache Store: Append latest tweet
        history[tweetId] = tweets[randomNum];

        // Sleep 1 minute between tweets
        if (i+1 != numRetweets) {
            await sleep(delaySeconds);
        }
    }

    ////// Cache Store: Write to file
    const json = JSON.stringify(history, null, 2);
    fs.writeFileSync('./history.json', json, err => {
        if (err) {
            console.log('Error writing to file', err)
            throw err;
        }
    })
}

if (require.main === module) {
    main().catch((err) => {
        console.log(err);
        process.exit(1);
    });
}

