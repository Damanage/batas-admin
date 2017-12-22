//Connection to Database
var pub;
var prv;
var pubwr;
var prvwr;

var dbopts;

function getPubData () {
  return new Promise (function (resolve, reject) {
    pub.view('show', 'battery', function(err, body, cb) {
      if (!err) {
        /*
        var data = [];
        try {
          body.rows.forEach(function(doc) {
            data.push({
              "id": doc.id,
              "rev": doc.value._rev,
              "type": doc.value.type,
              "status": doc.value.properties.status,
              "product": doc.value.properties.product,
              "price": doc.value.properties.price,
              "currency": doc.value.properties.currency,
              "comments": doc.value.properties.comments,
              "fromdate": doc.value.properties.fromdate,
              "geo": doc.value.geometry.coordinates
            });
          });
          resolve (data);
        } catch (e) {
            reject ("Error database replay: " + e);
          }
        */
        resolve(body);
      }
      else {
        reject ("Cann't get public data: " + err);
      }
    });
  });
}

function getPrvData () {
  return new Promise (function (resolve, reject){
    prv.view('show', 'desc', function(err, body, cb) {
      if (!err) {
        /*
        var data = [];
        try {
          body.rows.forEach(function(doc) {
            
            var links = [];
            
            for (var filename in doc.value._attachments) {
              
              links.push(filename);
            }
            
            data.push({
              "id": doc.id,
              "rev": doc.value._rev,
              "type": doc.value.type,
              "desc": doc.value.desc,
              "notes": doc.value.notes,
              "links": links
            });
            

          });
          resolve (data);
        } catch (e) {
            reject ("Error database replay: " + e);
          }
        */
        //Transform Links
        var prvlink = 'https://' + dbopts.batas_private.rkey +'@' + dbopts.url + "/batas_private/";
         
        for (var d in body.rows) {
            var links = '';
            for (var filename in body.rows[d].value._attachments) {
                links += 
                    "<p><a href='" 
                    + prvlink
                    +  body.rows[d].id
                    + "/" 
                    + filename  
                    + "'>"
                    + filename 
                    + "</a></p>";
            }
            body.rows[d].value.links = links;
        }
        
        resolve(body);
      }
      else {
        reject ("Cann't get public data: " + err);
      }
        
    });
  });
}

function getAllData () {
  return new Promise (function (resolve, reject) {
   Promise.all ([
      getPubData(),
      getPrvData()
    ])
    .then(
      function (r) {
        var data = [];
        
        var pub = r[0];
        var prv = r[1];
        
        for (var b in pub.rows) {
          for (var v in prv.rows) {
            if (pub.rows[b].id == prv.rows[v].id) {
              data.push({
                "pub": pub.rows[b].value, 
                "prv": prv.rows[v].value
              });
              break;
            }
          }
        }
        
        resolve ({
          "data": data
        });
      }
    )
    .catch(
      function (e) {
        reject(e);
      }
    );
  });
}

function saveBatteryRecord (pubdata, prvdata, files) {
  
  function savePubData (pubdata) {
    return new Promise(function (resolve, reject){
      pubwr.insert(pubdata, function (err, body) {
          if (!err) {
            resolve (body);
          } else {
            console.error(err);
            reject ("Cann't save public data: " + err);
          }
      });
    });
  }
  
  function savePrvData (doc, prvdata, files) {
    return new Promise(function (resolve, reject){
        var loads = [];
    
        for (var f in files) {
          loads.push({name: files[f].originalname, data: files[f].buffer, content_type: files[f].mimetype});
        }
        
        prvdata._id = doc.id;
        prvwr.multipart.insert(prvdata, loads, doc.id, function (err, body){
          if (!err) {
            resolve (body);
          } 
          else {
            console.error(err);
            reject (new Error("Cann't save private data"));
          }
        });

    });
  }
  
  function destroyPubData(doc) {
    return new Promise(function (resolve, reject){
      pubwr.destroy(doc.id, doc.rev, function(err, body) {
      if (!err)
        resolve(body);
      });   
    });
  }
  
  return new Promise (function (resolve, reject) {
    //Call chain of savings
    //console.info('Start savings');
    savePubData(pubdata)
    .then (
      //If all right, then save private data
      function (pubresult) {
        //console.info(pubresult);
        savePrvData(pubresult, prvdata, files)
          .then (
            //If ok, then resolve and end
            function (prvresult) {
              //console.info(prvresult);
              var r = {
                "success": true,
                "message": {
                      "pub": pubresult,
                      "prv": prvresult
                    }
              };
              resolve (r);
            },
            //if err, delete public data
            function (e) {
              destroyPubData(pubresult).then(
                reject(e)
              );
            }
          );
      }
    )
    .catch(
      function (e) {
        reject(e);
      }
    );
  });
}

function db (opts) {
    dbopts = opts;
    
    //Set coonection to Cloudant as reader
    pub = require('nano')('https://' + opts.batas_public.rkey +'@' + opts.url + "/batas_public"); 
    prv = require('nano')('https://' + opts.batas_private.rkey +'@' + opts.url + "/batas_private");
    
    //Set connection to Cloudant as writer
    pubwr = require('nano')('https://' + opts.batas_public.wkey +'@' + opts.url + "/batas_public");
    prvwr = require('nano')('https://' + opts.batas_private.wkey +'@' + opts.url + "/batas_private");    
    
    //Export get functions
    this.getPubData = getPubData;
    this.getPrvData = getPrvData;
    this.getAllData = getAllData;
    
    //Export save functions
    this.saveBatteryRecord = saveBatteryRecord;
}

module.exports = function (opts) {
  return new db(opts);
};