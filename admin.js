'use strict';

require("console-stamp")(console, {
    pattern:"dd.mm.yyyy HH:MM:ss.l",
    metadata:'[' + process.pid + ']',
});

const conf = require(process.env.CONF || '../config.json');

var express = require('express');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var jsonParser = bodyParser.json();

var multer  = require('multer');
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });

var db = require("./db/db")(conf.db);

var app = express();

app.use(cookieParser());


app.use('/login', express.static(__dirname + '/client/login.html'));

app.post('/login', urlencodedParser, function(req, res, next) {
    if (req.body && req.body.pwd) {
      var crypto = require('crypto');
      var hash = crypto.createHash('sha512').update(req.body.pwd).digest('hex');
      if (hash == conf.APItoken.hash) {
        res.cookie('APIToken' , hash).redirect('/');
      }
      else {
        res.redirect('/login');
      }
    } else {
      res.redirect('/login');
    }
});

app.use('/', function(req, res, next){
  if (req.cookies.APIToken == conf.APItoken.hash) {
    next();
  }
  else {
    res.redirect('/login');
    /*
    res.status(403).send({
      success: false,
      message: 'No token provided.'
    });
    */
  }
});

app.use('/', express.static(__dirname + '/client'));

app.get('/api/pub', function (req, res) {
  db.getPubData()
  .then(
    function (d) {
      res.send(d);
    },
    function (e) {
      console.error(e);
      res.status(403).send({
        success: false,
        message: e
      });
    }
  );
});

app.get('/api/prv', function (req, res) {
 db.getPrvData()
 .then(
    function (d) {
      res.send(d);
    },
    function (e) {
      console.error(e);
      res.status(403).send({
        success: false,
        message: e
      });
    }
  );
});

app.get('/api/all', function (req, res) {
  db.getAllData()
  .then(
    function (d) {
      res.send(d);
    }, 
    function (e) {
      console.error(e);
      res.status(403).send({
        success: false,
        message: e
      });
    }
  );
});

app.post('/api/upload', upload.array('files'), function (req, res, next) {
  
  try {
    var data = JSON.parse(req.body.data);
  } catch (e) {
    console.info('Error JSON Parse');
    res.status(403).send({
      success: false,
      message: e
    });
    
    return new Error(e);
  }
  
  var pubdata = data.pub;
  var prvdata = data.prv;
  
  function validateInput() {

    
    if (!pubdata) return {success: false, message: 'No public data'};
    if (!prvdata) return {success: false, message: 'No private data'};
    if (!req.files.length) return {success: false, message: 'No files selected'};
    
    //Some Input validation
    if (!(pubdata.type == 'Battery')) return {success: false, message: 'Not valid type'};
    
    if (!pubdata.properties.product) return {success: false, message: 'Not valid product'};
    
    if (!(pubdata.geometry.coordinates[0] && pubdata.geometry.coordinates[1])) return {success: false, message: 'No point selected'};
    
    
    return {success: true, message: ''};
  }
  
  var v = validateInput();
  
  /*
  if (v.success) {
    
    
    var pub = require('nano')('https://' + conf.db.batas_public.wkey +'@' + conf.db.url + "/batas_public");
    
    var r = {
      success: true,
      message: {
        pub: {},
        prv: {}
      }
    };
    
    pub.insert(pubdata, function (err, body) {
      if (!err) {
        //console.info(body);
        r.message.pub = body;
    
        var files = [];
    
        for (var f in req.files) {
          files.push({name: req.files[f].originalname, data: req.files[f].buffer, content_type: req.files[f].mimetype});
        }
     
        var prv = require('nano')('https://' + conf.db.batas_private.wkey +'@' + conf.db.url + "/batas_private");    
        
        prvdata._id = r.message.pub.id;
        prv.multipart.insert(prvdata, files, r.message.pub.id, function (err, body){
          if (!err) {
            r.message.prv = body;
            
            res.send(r); 
          } 
          else {
            console.error(err);
            res.status(403).send({
              success: false,
              message: err
            });
          }
        });
      }
      else {
        console.error(err);
        res.status(403).send({
          success: false,
          message: err
        });
      }
    });
    
    
    
  }
  */
  
  if (v.success) {
    db.saveBatteryRecord(pubdata, prvdata, req.files)
    .then(
      function (r) {
         res.send(r); 
      },
      function (e) {
        console.error(e);
        res.status(403).send({
          success: false,
          message: e
        });
      }
    );
  }
  else {
    console.info('Validation error');
    res.status(403).send({
      success: false,
      message: v.message
    });
  }
});

app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function () {
  console.info("Example app listening on " + (process.env.IP || "0.0.0.0") + ":" + (process.env.PORT || 3000));
});