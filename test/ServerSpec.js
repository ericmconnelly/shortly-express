var expect = require('chai').expect;
var request = require('request');

var db = require('../app/config');
var Users = require('../app/collections/users');
var User = require('../app/models/user');
var Links = require('../app/collections/links');
var Link = require('../app/models/link');


var requestWithSession = request.defaults({jar: true});

it('Only shortens valid urls, returning a 404 - Not found for invalid urls', function(done) {
  var options = {
    'method': 'POST',
    'uri': 'http://127.0.0.1:4568/links',
    'json': {
      'url': 'definitely not a valid url'
    }
  };

  requestWithSession(options, function(error, res, body) {
    // res comes from the request module, and may not follow express conventions
    expect(res.statusCode).to.equal(404);
    done();
  });
});

describe('Shortening links:', function(){

  var options = {
    'method': 'POST',
    'followAllRedirects': true,
    'uri': 'http://127.0.0.1:4568/links',
    'json': {
      'url': 'http://roflzoo.com/'
    }
  };

  it('Responds with the short code', function(done) {
    requestWithSession(options, function(error, res, body) {
      expect(res.body.url).to.equal('http://roflzoo.com/');
      expect(res.body.code).to.not.be.null;
      done();
    });
  });

  it('New links create a database entry', function(done) {
        requestWithSession(options, function(error, res, body) {
          db.knex('urls')
            .where('url', '=', 'http://roflzoo.com/')
            .then(function(urls) {
              if (urls['0'] && urls['0']['url']) {
                var foundUrl = urls['0']['url'];
              }
              expect(foundUrl).to.equal('http://roflzoo.com/');
              done();
            });
        });
      });

  it('Fetches the link url title', function (done) {
        requestWithSession(options, function(error, res, body) {
          expect(res.body.title).to.equal('Funny pictures of animals, funny dog pictures');
          done();

          // console.log(res.body.title);
          // db.knex('urls')
          //   .where('title', '=', 'Funny animal pictures, funny animals, funniest dogs')
          //   .then(function(urls) {
          //     if (urls['0'] && urls['0']['title']) {
          //       var foundTitle = urls['0']['title'];
          //     }
          //     expect(res.body.title).to.equal('Funny animal pictures, funny animals, funniest dogs');
          //     done();
          //   });
        });
      });

  describe('With previously saved urls:', function(){

      var link;

      beforeEach(function(done){
        // save a link to the database
        link = new Link({
          url: 'http://roflzoo.com/',
          title: 'Funny animal pictures, funny animals, funniest dogs',
          base_url: 'http://127.0.0.1:4568'
        });
        link.save().then(function(){
          done();
        });
      });

      it('Returns the same shortened code', function(done) {
        var options = {
          'method': 'POST',
          'followAllRedirects': true,
          'uri': 'http://127.0.0.1:4568/links',
          'json': {
            'url': 'http://roflzoo.com/'
          }
        };

      requestWithSession(options, function(error, res, body) {
          var code = res.body.code;
          expect(code).to.equal(link.get('code'));
          done();
        });
      });


    it('Shortcode redirects to correct url', function(done) {
        var options = {
          'method': 'GET',
          'uri': 'http://127.0.0.1:4568/' + link.get('code')
        };

        requestWithSession(options, function(error, res, body) {
          var currentLocation = res.request.href;
          expect(currentLocation).to.equal('http://roflzoo.com/');
          done();
        });
      });

    it('Returns all of the links to display on the links page', function(done) {
        var options = {
          'method': 'GET',
          'uri': 'http://127.0.0.1:4568/links'
        };

        requestWithSession(options, function(error, res, body) {
          expect(body).to.include('"title":"Funny animal pictures, funny animals, funniest dogs"');
          expect(body).to.include('"code":"' + link.get('code') + '"');
          done();
        });
      });
    });

  //AUTHENTICATION
  describe('Privileged Access:', function(){

    it('Redirects to login page if a user tries to access the main page and is not signed in', function(done) {
      request('http://127.0.0.1:4568/', function(error, res, body) {

        // console.log(res);
        // console.log(body);
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

    it('Redirects to login page if a user tries to create a link and is not signed in', function(done) {
      request('http://127.0.0.1:4568/create', function(error, res, body) {
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

    it('Redirects to login page if a user tries to see all of the links and is not signed in', function(done) {
      request('http://127.0.0.1:4568/links', function(error, res, body) {
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

  }); // 'Priviledged Access'
  



});