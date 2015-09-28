Error.stackTraceLimit = Infinity;

var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var passport = require('passport');
var GithubStrategy = require('passport-github').Strategy;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//////adding session
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

//express session
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}));

//add Passport middleware
app.use(passport.initialize());
app.use(passport.session());

//add cookie parser
app.use(express.cookieParser());


passport.use(new GithubStrategy({
    clientID: 'b3e80b8723ed3f5c76d0',
    clientSecret: 'e0d02473c37d6e8ed4788987b1273ad3ed10a073',
    callbackURL: "http://127.0.0.1:4569/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log('Authenticate!');
    process.nextTick(funtion(){
      done(null,profile);
    });
    // User.findOrCreate({ githubId: profile.id }, function (err, user) {
    //   return done(err, user);
    // });
  }
));
  //save user information for persistent login
  passport.serializeUser(function(user, done){
    console.log("serial!");
    done(null, user);
  });

  //remove user session
  passport.deserializeUser(function(obj, done){
    console.log("deserial!");
    done(null, done);
  });

app.get('/auth/github',
  passport.authenticate('github'));


app.get('/auth/github/callback', 
  passport.authenticate('github', 
  { failureRedirect: '/error' ,
    successRedirect: '/succrss'
  }));
  // function(req, res) {
  //   // Successful authentication, redirect home.
  //   res.redirect('/');

//references the application router like post or get
app.all('*', function(req, res, next){
  console.log(req);
  next();
});

app.get('/error', function(req, res, next){
  res.end('Failure to log in');
});

app.get('/success', function(req, res, next){
  res.end('Successfully logging in!');
});

var checkUser = function(req, res){
  if(!req.session.user){
    res.redirect('/login')
  }
};


app.get('/', 
function(req, res) {
  // if(!req.session.user){
  //   res.redirect('/login')
  // }else{
  //   res.render('index');
  // }

  checkUser(req, res);
  res.render('index');
});

app.get('/create', 
function(req, res) {
  if(!req.session.user){
    res.redirect('/login')
  }else{
    res.render('index');
  }
});


app.get('/login',
  function(req, res){
    res.render('login')
});


//handling sign up get
app.get('/signup',
  function(req, res){
    res.render('signup');
});

//handliing sign up post request
app.post('/signup', 
  function(req, res){
    var myHash;
    bcrypt.hash(req.body.password, null, null, function(err, hash) {
    // Store hash in your password DB.
      if (err) {console.log("ERROR: ", err); }
      new User({username: req.body.username}).fetch().then( function(found) {
        if(found) {
          console.log("This user already exists!");
        } else {
          var user = new User( {username: req.body.username, hashPassword: hash});
          user.save().then(function(newUser) {
            console.log("New user created");
          });

        }
      })
    });


});

// app.post('/login',
//   passport.authenticate('local'),
//   function(req, res) {
//     // If this function gets called, authentication was successful.
//     // `req.user` contains the authenticated user.
//     res.redirect('/users/' + req.user.username);
//   });

app.post('/login', function(req, res){
  // var userPassword = req.body.password;
  // var myHash; 
  // db.knex('users').select('hashPassword').where('username', req.body.username).then(function(result){
  //   var myHash = result[0].hashpassword;
  //   var isTrue = bcrypt.compareSync(userPassword, myHash);
  //     if(isTrue){
  //       //do redirect
  //       req.session.regenerate(function() {
  //         req.session.user = req.body.username;
  //         res.redirect('/');
  //       })
  //       //res.redirect('/');
  //     }else{
  //       console.log("Invalid Password");
  //     }
  // });

  passport.authenticate('github', { successRedirect: '/',
                                   failureRedirect: '/links',
                                   failureFlash: true });

});

app.get('/signout', function(req, res){
  req.session.destroy(function(){
    res.redirect('/login');
  });
});


app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  console.log(">>>>URI: ", uri)

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      //console.log("URI FOUND: ", found);
      res.send(200, found.attributes);
    } else {
      console.log("URI NOT FOUND");
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        console.log(">>>>title: ", title)

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });
        console.log(">>>>Link: ", link)

        link.save().then(function(newLink) {
          Links.add(newLink);
          console.log(">>>>>>> Inside link save callback")
          console.log(">>>>>newLInk",newLink)
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);