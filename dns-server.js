'use strict';

let dns = require('native-dns');
let server = dns.createServer();

server.on('listening', () => console.log('server listening on', server.address()));
server.on('close', () => console.log('server closed', server.address()));
server.on('error', (err, buff, req, res) => console.error(err.stack));
server.on('socketError', (err, socket) => console.error(err));

server.serve(53);


let authority = { address: '8.8.8.8', port: 53, type: 'udp' };

function proxy(question, response, cb) {
  //console.log('proxying', question.name);

  var request = dns.Request({
    question: question, // Forward the query
    server: authority,  // Parent DNS server to get IP address of the request
    timeout: 1000
  });

  // when we get answers, append them to the response
  // When gets answers from Parent DNS, append it to response.
  request.on('message', (err, msg) => {
    msg.answer.forEach(a => response.answer.push(a));
  });

  request.on('end', cb);
  request.send();
}

let async = require('async');

let whitelist = [ 'naver', 'daum', 'philgo', 'google', 'witheng', 'skype' ];

function handleRequest(request, response) {

  let f = []; // Array of functions

  // Proxy all questions
  // Since proxying is asynchronous, store all callbacks
  request.question.forEach(question => {
      // Domains that you want allow.
      //let entry = whitelist.filter( r => new RegExp(r, 'i').exec(question.name));
      let entry = whitelist.filter( ( currentValue, index, arr ) => {
        if ( question.name.indexOf( currentValue ) != -1 ) return currentValue;
      });
      // When a domain matches in whitelist, response with real IP address.
      if (entry.length) {
        console.log('PASS: request from: ', request.address.address, ' for: ', question.name);
        f.push(cb => proxy(question, response, cb));
      }
      else { // or block it.
          console.log('BLOCK: request from: ', request.address.address, ' for: ', question.name);
          let record = {};
          record.name = question.name;
          record.ttl = record.ttl || 1800;
          record.address = '218.50.181.110';
          record.type = 'A';
          response.answer.push(dns['A'](record));
    }
  });

  // Do the proxying in parallel
  // when done, respond to the request by sending the response
  async.parallel(f, function() { response.send(); });
}


server.on('request', handleRequest);