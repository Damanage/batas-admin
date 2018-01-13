//Connection to Database
var pub;
var prv;
var pubwr;
var prvwr;

var dbopts;

function createPaymentFact (prodid, paymentid) {
  //If we have payment
  
  return new Promise (function (resolve, reject) {
    var data = {
      "type": "PaymentFact",
      "productid": prodid
    };
    
    checkPaymentFact(prodid)
    .then (
      function (body) {
        resolve (body);
      },
      function (err) {
        //Вставляем запись, так как её нет
        prvwr.insert(data, paymentid, function (err, body) {
          if (!err) {
            resolve (body);
          } 
          else
          {
            console.error(err);
            reject ("Cann't save payment data: " + err);
          }
       });
    });
  });
}

function checkPaymentFact (prodid) {
  return new Promise (function (resolve, reject) {
    prv.view('show', 'payment', { "key": prodid }, function(err, body, cb) {
      if (!err) {
        if (body.rows && body.rows.length > 0) 
        {
          resolve(body);
        }
        else 
        {
          reject("There is no payment fact");
        }
      }
      else {
        reject("Cann't get payment fact: " + err);
      }

    });
  });
}

function getPrvFileUrl (id, file) {
  return new Promise (function(resolve, reject){
    checkPaymentFact(id)
    .then(
      function(fact) {
        resolve ('https://' + dbopts.batas_private.rkey +'@' + dbopts.url + '/batas_private/' + id + '/'+ file);
      },
      function(err) {
        reject ("Problem with payment fact: " + err);
      }
    );
  });
}

function getPubProductById (id) {
  return new Promise (function (resolve, reject) {
    pub.get(id, {revs_info: false}, function(err, body, cb) {
      if (!err) {
        resolve(body);
      }
      else {
        reject ("Cann't get product by id: " + err);
      }
    });
  });
}

function getPrvProductById (id) {
  return new Promise (function (resolve, reject) {
    prv.get(id, {revs_info: false}, function(err, body, cb) {
      if (!err) {
        resolve(body);
      }
      else {
        reject ("Cann't get product by id: " + err);
      }
    });
  });
}

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

function savePaymentReq (payment) {
  return new Promise (function (resolve, reject){
    var data = {
      "type": "PaymentReq",
      "payment": payment
    };
    prvwr.insert(data, payment.id, function (err, body) {
      if (!err) {
        var result = {
          "status" : body,
          "data" : data
        };
        resolve (result);
      } else {
        if (err.statusCode == '409')
        {
          //We have 'Document update conflict.
          //May be user two times tryes or may be this is another user tryes to buy the same product
          //Never mind resole
          resolve ({
            "status": {
              "satus": "ok",
              "_id": payment.id
            },
            "data" : data
          });
        }
        else 
        {
          console.error(err);
          reject ("Cann't save payment data: " + err);
        }
      }
    });
  });
}

function saveBatterySatus(id, status) {
  
  function saveStatus (db, id, status) {
    return new Promise (function(resolve, reject) {
      db.get(id, {revs_info: true}, function(err, body, cb) {
        if (!err) {
          body.status = status;
          
          db.insert(body, body.id, function (err, result) {
            if (!err) 
            {
              resolve (result);
            } 
            else 
            {
                console.error(err);
                reject ("Cann't save status data: " + err);
            }
          });
          
          resolve(body);
        }
        else {
          reject ("Cann't get product by id: " + err);
        }
      });
    });
  }
  
  return new Promise (function (resolve, reject){
    saveStatus(pubwr, id, status)
    .then (saveStatus(prvwr, id, status))
    .then(
      resolve({
        "success": true,
        "message": 'Satus saved'
      })
    )
    .catch (function (e) {
      reject(e);
    });
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
    this.getPubProductById = getPubProductById;
    this.getPrvProductById = getPrvProductById;
    this.getPrvFileUrl = getPrvFileUrl;
    this.checkPaymentFact = checkPaymentFact;
    
    //Export save functions
    this.saveBatteryRecord = saveBatteryRecord;
    this.savePaymentReq = savePaymentReq;
    this.saveBatterySatus = saveBatterySatus;
    this.createPaymentFact = createPaymentFact;
}

module.exports = function (opts) {
  return new db(opts);
};