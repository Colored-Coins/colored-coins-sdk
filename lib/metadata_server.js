var rsa = require('node-rsa')
var Client = require('node-rest-client').Client

var client = new Client()

var MetadataServer = function(settings) {
  var self = this
  self.settings = settings || {}
  self.host = settings.host

  client.registerMethod("upload", this.host + "/addMetadata", "POST")
  client.registerMethod("seed", this.host + "/shareMetadata?torrentHash=${torrentHash}", "GET")
  client.registerMethod("download", this.host + "/getMetadata?torrentHash=${torrentHash}", "GET")
}

MetadataServer.prototype.upload = function uploadMetadata(metadata, callback) {
  var self = this

  if(!metadata.metadata && !metadata.rules) {
    return callback(null, metadata)
  }
  var metafile = {}
  if(metadata.metadata) {
    var key = self._tryEncryptData(metadata)
    if(key && key.error) {
      return callback(new Error('Encryption error while uploading metadata', key.error))
    }
    else if(key && key.privateKey) {
      metadata.privateKey = key.privateKey
    }

    metafile.data = metadata.metadata
  }
  if(metadata.rules)
    metafile.rules = metadata.rules

  var args = {
    data : {
      "metadata": metafile
    },
    headers:{"Content-Type": "application/json"}
  }

  client.methods.upload(args, function (data, response) {
    if (response.statusCode == 200) {
      var torrentdata = self._safeParse(data)
      metadata.torrentHash = torrentdata.torrentHash
      metadata.sha1 = torrentdata.torrentHash
      metadata.sha2 = torrentdata.sha2
      return callback(null, metadata)
    }
    else if(data) {
      return callback(new Error('Error when uploading metadata', response.statusCode))
    }
    else {
      return callback(new Error('Error when uploading metadata', response.statusCode))
    }
  }).on('error', function (err) {
    return callback(new Error('Error when uploading metadata', err.request.options))
  })
}

MetadataServer.prototype.seed = function seedMetadata(hash, callback) {
  if(!hash) {
    return callback(null, null)
  }

  var args = {
    path: { "torrentHash": hash },
    headers:{"Content-Type": "application/json"}
  }

  client.methods.seed(args, function (data, response) {
    if (response.statusCode == 200) {
      return callback(null, data)
    }
    else if(data) {
      return callback(new Error('Error when seeding metadata', response.statusCode))
    }
    else {
      return callback(new Error('Error when seeding metadata', response.statusCode))
    }
  }).on('error', function (err) {
    return callback(new Error('Error when seeding metadata', err.request.options))
  })
}

MetadataServer.prototype.download = function(hash, callback) {
  if(!hash) {
    return callback()
  }

  var args = {
    path: { "torrentHash": hash },
    headers:{"Content-Type": "application/json"}
  }


  client.methods.download(args, function (data, response) {
    if (response.statusCode == 200) {
      var torrentdata = null
      try { torrentdata = self._safeParse(data) } catch(e) { torretdata = data }
      return callback(null, data)
    }
    else if(data) {
      return callback(new Error('Error when seeding metadata', response.statusCode))
    }
    else {
      return callback(new Error('Error when seeding metadata', response.statusCode))
    }
  }).on('error', function (err) {
    return callback(new Error('Error when downloading metadata', err.request.options))
  })

}

MetadataServer.prototype._tryEncryptData = function(metadata) {
  try {
    if(metadata.metadata && metadata.metadata.encryptions && metadata.metadata.userData) {
      var oneKey = new rsa({b: 1024})
      var returnKey = false
      metadata.metadata.encryptions.forEach(function (encSection){
        returnKey = returnKey || !encSection.pubKey
        var section = metadata.metadata.userData[encSection.key]
        if(section) {
          var format = encSection.type + '-public-' +  encSection.format
          var key = encSection.pubKey ? new rsa([encSection.pubKey]) : oneKey
          var encrypted = key.encrypt(section, 'base64')
          metadata.metadata.userData[encSection.key] = encrypted
        }
      })
      return { privateKey: returnKey ? oneKey.exportKey('pkcs8').toString('hex') : '' }
    }
  }
  catch(e) {
    return { error: e }
  }
}

MetadataServer.prototype._safeParse = function safeParse (item) {
  try {
    if ((typeof item === 'string') || (item instanceof Buffer)) {
      return JSON.parse(item)
    } else {
      return item
    }
  } catch (e) {
    return item
  }
}

module.exports = MetadataServer
