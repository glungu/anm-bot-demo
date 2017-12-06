var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');
// var requestSync = require('sync-request');

// var globalTunnel = require('global-tunnel');
// process.env.http_proxy = 'http://genproxy.amdocs.com:8080';
// process.env.https_proxy = 'https://genproxy.amdocs.com:8080';
// globalTunnel.initialize();
// globalTunnel.end();

var luisUrlPrefix = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/";
var luisKey = "6abe6f0082814c1d9edc2ab97ff0ad30";
var luisAppID = "3482ee72-4216-44ed-877a-c6f25a70f294";
var luisStaging = "true";
var luisURL = process.env.LUIS_APP_URL || luisUrlPrefix + luisAppID + "?"
        + "subscription-key=" + luisKey + "&"
        + "staging=" + luisStaging;

function accessLuis(text, callback) {
    var serviceUrl = luisURL + "&q=" + text;
    // var resp = requestSync('GET', getURL);
    // var bodyObject = JSON.parse(resp.getBody());
        
    // request({'url' : serviceUrl, 'proxy' : 'http://10.232.233.70:8080'},
    request({'url' : serviceUrl}, 
        function (error, response, body) {
            var topScoringIntent = null;
            var topScoringIntentScore = null;
            var topScoringIntentChannel = null;
            if (!error && response.statusCode == 200) {
                console.log('### response from LUIS: ' + body);
                var bodyObject = JSON.parse(body);

                if (undefined != bodyObject && undefined != bodyObject.topScoringIntent.intent) {
                    topScoringIntent = bodyObject.topScoringIntent.intent;
                    topScoringIntentScore = bodyObject.topScoringIntent.score;
                    var entityName = null;
                    if (topScoringIntent == "ANM.ChangeLanguage") {
                        entityName = "ANM.NewLanguage";
                    } else if (topScoringIntent = "ANM.AddChannel") {
                        entityName = "ANM.NewChannel";
                    }
                    if (entityName) {
                        for (var i in bodyObject.entities) {
                            if (bodyObject.entities[i].type == entityName) {
                                topScoringEntity = bodyObject.entities[i].entity;
                            }
                        }
                    }
                    console.log('### topScoringIntent: ' + topScoringIntent + ", " 
                                + "score: " + topScoringIntentScore + ", "
                                + "entity: " + topScoringEntity);
                } 
            } else {
                console.log('### Error from LUIS: ' + error + ', ' + response + ', body: ' +  body);
            }					

            if (topScoringIntent != null && topScoringIntent != "None" && topScoringIntentScore > 0.5) {
                console.log("### returning result: " + topScoringIntent);
                var result = {
                    intent: topScoringIntent,
                    entity: topScoringEntity 
                };
                callback(result);                               
            } else {
                console.log("### returning null");
                callback(null);
            }
        }
    );
}

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Create bot
var bot = new builder.UniversalBot(connector, [
    function(session) {
        // session.send("Welcome, how can I help?");
        if (session.dialogData.location == null) {
            session.dialogData.location = {};
        }
        builder.Prompts.text(session, "Welcome, how can I help?");
    },
    function(session, results) {
        accessLuis(results.response, function(result) {
            if (result && result.intent) {
                console.log("### result: " + result.intent + ", entity: " + result.entity);
                session.userData.intent = result.intent;
                session.userData.entity = result.entity;
                session.beginDialog("ShowIntent");
            }
        });
        // session.endConversation("Bye");
    } 
]);

// bot.recognizer(new builder.LuisRecognizer(luisURL));

// Send welcome when conversation with bot is started, by initiating the root dialog 
bot.on('conversationUpdate', function (message) { 
    if (message.membersAdded) { 
        message.membersAdded.forEach(function (identity) { 
            if (identity.id === message.address.bot.id) { 
                bot.beginDialog(message.address, '/'); 
            } 
        }); 
    } 
});

bot.dialog('ShowIntent', [
    function (session, args, next) {
        console.log("### start show intent dialog");
        // Get info from LUIS.
        var intent = session.userData.intent;
        var entity = session.userData.entity;

        if (entity == null) {
            if (intent == "ANM.AddChannel") {
                session.beginDialog("AskChannel");
            } else if (intent == "ANM.ChangeLanguage") {
                session.beginDialog("AskLanguage");
            }
        } else {
            next();
        } 
    },
    function (session, results, next) {
        console.log("### step 2");
        if (results.response != null) {
            session.userData.entity = results.response;
        } 
        next();
    },
    function (session, results) {
        console.log("### step 3");
        var msg = new builder.Message(session).attachments([
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    type: "AdaptiveCard",
                    body: [
                        {
                            "type": "TextBlock",
                            "text": "Response from LUIS",
                            "size": "large",
                            "weight": "bolder"
                        },
                        {
                            "type": "TextBlock",
                            "text": "Intent: " + session.userData.intent
                        },
                        {
                            "type": "TextBlock",
                            "text": "Entity: " + session.userData.entity
                        }
                    ]
                }
            },
            new builder.HeroCard(session)
            // .title("Classic Gray T-Shirt")
            // .subtitle("100% Soft and Luxurious Cotton")
            .text("Is it correct?")
            .buttons([
                builder.CardAction.imBack(session, "Accept", "Yes"),
                builder.CardAction.imBack(session, "Reject", "No")
            ])
        ]);
        builder.Prompts.choice(session, msg, ["Yes", "No"]);
        // session.send(msg);
        // builder.Prompts.text(session, "Is it correct?");
    }
]);

bot.dialog('Yes', [
    function (session, args, next) {
        if (session.userData.intent) {
            session.send("Confirmed: it's a Yes");
        }
        // session.reset();
        // session.endDialog();
        session.userData = {};
        session.clearDialogStack();
        session.reset();
    }
]).triggerAction({ matches: /(yes|accept)/i });

bot.dialog('No', [
    function (session, args, next) {
        if (session.userData.intent) {
            session.send("Confirmed: it's a No");
        }
        // session.reset();
        // session.endDialog();
        session.userData = {};
        session.clearDialogStack();
        session.reset();
    }
]).triggerAction({ matches: /(no|reject)/i });

bot.dialog('AskChannel', [
    function (session, args, next) {
        builder.Prompts.text(session, "By means of what channel?");    
    },
    function (session, results) {
        console.log("### check channel result");
        session.endDialogWithResult(results);
    }
]);
