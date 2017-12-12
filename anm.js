/*
Pre-requisites:
npm install sync-request
*/

/**
  languageId  for example 'fr-FR'. If parameter is null field in ANM will be updated by current value
  timeZone  for example 'Europe/Paris'. If parameter is null field in ANM will be updated by current value
  toAddress for example 'andreyp@amdocs.com'. If parameter is null field in ANM will be updated by current value
*/
function updateSubscriber(languageId, emailAddress) {
  // var soap_url = 'http://10.233.184.202:8070/ws/ANMProvisioningServiceV3';
  var soap_url = process.env.ANM_URL + '/ws/ANMProvisioningServiceV3';

  console.log('Loading subscriber');
  var subscriber = getSubscriber(soap_url);
  console.log('Loaded subscriber');
  console.log(subscriber);

  if (!subscriber.isValid) {
    console.log('Cannot load subscriber from ANM');
  } else {
    var fs = require('fs')
    var data = fs.readFileSync('./anm_modify_subscriber.xml', 'utf8');
    
    if (languageId != null) {
      subscriber['languageId'] = languageId;
    }
    if (emailAddress != null && emailAddress != "") {
      subscriber['emailAddress'] = emailAddress;
      subscriber['emailEnabled'] = 'true';
    }

    data = data.replace(/%language_id%/g, subscriber['languageId']);
    data = data.replace(/%email_address%/g, subscriber['emailAddress']);
    data = data.replace(/%email_enabled%/g, subscriber['emailEnabled']);
    data = data.replace(/%phone_number%/g, subscriber['phoneNumber']);
    
    console.log('### update soap: ');
    console.log(data);

    var request = require('sync-request');
    var response = request('POST', soap_url, {
      body : data
    });

    console.log('response.statusCode=' + response.statusCode);
    console.log('response.body=' + response.body.toString());
    if (response.statusCode == 200) {
      var body = response.body.toString();
      if (body.indexOf('result>true') != -1) {
        return true;
      }
    }
  }

  return false;
}

function getSubscriber(soap_url) {
  var subscriberId = 'user-05';
  var fs = require('fs')

  var soapContent = fs.readFileSync('./anm_get_subscriber.xml', 'utf8');
  
  console.log(soapContent);

  var request = require('sync-request');

  var response = request('POST', soap_url, {
    body : soapContent
  });

  console.log('response.statusCode=' + response.statusCode);
  console.log('response.body=' + response.body.toString());

   
  var subscriber = {};
  subscriber['isValid'] = false;
  if (response.statusCode == 200) {
    var body = response.body.toString();

    var pattern = new RegExp(/<(.*):languageId>(.*)<\/(.*):languageId>/g);
    var match = pattern.exec(body);
    if (match) {
      subscriber['languageId'] = match[2];
    }
    console.log('languageId=' + subscriber['languageId']);

    pattern = new RegExp(/<(.*):toAddress>(.*)<\/(.*):toAddress>/g);
    match = pattern.exec(body);
    if (match) {
      subscriber['emailAddress'] = match[2];
    }
    console.log('emailAddress=' + subscriber['emailAddress']);
    
    if (subscriber['emailAddress'] != null && subscriber['emailAddress'] != "") {
      subscriber['emailEnabled'] = 'true';
    }

    pattern = new RegExp(/<(.*):address>(.*)<\/(.*):address>/g);
    match = pattern.exec(body);
    if (match) {
      subscriber['phoneNumber'] = match[2];
    }
    
    subscriber['isValid'] = true;
  }

  return subscriber;
}

module.exports.updateSubscriber = updateSubscriber
