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
  console.log('proxying', question.name);

  var request = dns.Request({
    question: question, // forwarding the question
    server: authority,  // this is the DNS server we are asking
    timeout: 1000
  });

  // when we get answers, append them to the response
  request.on('message', (err, msg) => {
    msg.answer.forEach(a => response.answer.push(a));
  });

  request.on('end', cb);
  request.send();
}

let async = require('async');

let whitelist = [ 'naver', 'daum', 'philgo', 'google', 'witheng', 'skype' ];

function handleRequest(request, response) {
  console.log('request from', request.address.address, 'for', request.question[0].name);

  let f = []; // array of functions

  // proxy all questions
  // since proxying is asynchronous, store all callbacks
  request.question.forEach(question => {
      // 변경하려고 하는 도메인
    let entry = whitelist.filter(r => new RegExp(r, 'i').exec(question.name));
    // 매치가 되면
    if (entry.length) {
      f.push(cb => proxy(question, response, cb));
    } else {
        // 임의의 IP 로 변경
        let record = {};
        record.name = question.name;
        record.ttl = record.ttl || 1800;
        record.address = '127.0.0.1';
        record.type = 'A';
        response.answer.push(dns['A'](record));
    }
  });

  // do the proxying in parallel
  // when done, respond to the request by sending the response
  async.parallel(f, function() { response.send(); });
}


server.on('request', handleRequest);