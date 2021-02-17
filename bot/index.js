// Import twitter library
const Twitter = require("twitter-v2");

// Import twitter account credentials
const client = new Twitter(require("./config"));


////// Query

// Number of latest results (10 - 100 inclusive)
const numTweets = 10;

// Hashtags to follow
const hashtags = [
    "#occmed",
    "#occenvmed"
];

// Build query
const hashtagString = hashtags.join(" OR ");

// Make GET Request for tweet data
const {data: tweets, meta, errors } = await client.get("tweets/search/recent", {
    query: hashtagString + " lang:en",
    max_results: numTweets,
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
console.log(tweets);


////// Filter



////// Cache



////// Retweet



////// Repeat





