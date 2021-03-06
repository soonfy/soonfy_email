var Email = require('../models/email')
var Map = require('../models/article_email')
var async = require('async')
let fs = require('fs')
let path = require('path')
let iconv_lite = require('iconv-lite')

exports.search = function (req, res) {
  var address = req.query.address || null
  Email
    .findByAddress(address, 0, 0, function (err, emails) {
      if (err) {
        console.log(err);
      }
      res.render('emaillist', {
        title: '邮件列表',
        emails: [emails]
      })
    })
}

exports.list = function (req, res) {
  var limit = 100
  var page = req.query.page || 1
  page = parseInt(page)
  Email.count(function (err, len) {
    var pages = Math.ceil(len / limit)
    // console.log(page, pages);
    if(page > pages){
      page = 1
    }
    var skip = (page - 1) * limit
    Email
      .findByAddress(null, skip, limit, function (err, emails) {
        if (err) {
          console.log(err);
        }
        res.render('emaillist', {
          title: '邮件列表',
          emails: emails,
          page: page,
          pages: pages
        })
      })
  })
}

exports.getInsert = function (req, res) {
  res.render('emailinsert', {
    title: '添加邮件',
    message: ''
  })
}

exports.postInsert = function (req, res) {
  let {address, name} = req.body
  if (address) {
    Email.findOne({ address: address }, {}, function (err, email) {
      if (email === null) {
        var _email = new Email({
          name: name,
          address: address,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        _email.save(function (err) {
          if (err) {
            console.log(err)
          }
          console.log('email insert...')
          res.redirect('/email/list')
        })
      } else {
        res.redirect('/email/list')
      }
    })
  } else {
    res.redirect('/email/list')
  }
}

exports.getUpdate = function (req, res) {
  let email = req.query
  res.render('emailupdate', {
    title: '修改邮件',
    email: email,
    message: ''
  })
}

exports.postUpdate = function (req, res) {
  let {_id, address, name} = req.body
  if (address) {
    Email.findOne({ _id: _id }, {}, function (err, email) {
      if (email === null) {
        console.log('error')
        res.redirect('/email/list')
      } else {
        email.name = name
        email.address = address
        email.updatedAt = Date.now()
        email.save(function (err) {
          if (err) {
            console.log(err)
          }
          console.log('email update...')
          res.redirect('/email/list')
        })
      }
    })
  } else {
    res.redirect('/email/list')
  }
}

exports.del = function (req, res) {
  var id = req.query.id.split(',')

  if (id) {
    for (var i = 0; i < id.length; i++) {
      async.series([
        function (cb) {
          Email
            .remove({ _id: id[i] }, function (err, email) {
              if (err) {
                cb('remove email error')
              }
            })
          Map
            .remove({ emailId: id[i] }, function (err, email) {
              if (err) {
                cb('remove article_email map error')
              }
              cb(null)
            })
        }
      ],
        function (err, results) {
          if (err) {
            console.log(err);
          }
        })
    }
  }
  res.send()
}

exports.download = function (req, res) {
  let filename = '错误邮箱列表.csv'
  let head = '用户名,邮件地址\n'
  head = iconv_lite.encode(head, 'gbk')
  let filepath = path.join(__dirname, 'data', filename)
  fs.writeFileSync(filepath, head)
  Email.find({ status: 0 }, function (err, datas) {
    datas.map(data => {
      let {name, address} = data
      let metas = [name, address]
      let line = metas.join(',') + '\n'
      line = iconv_lite.encode(line, 'gbk')
      fs.appendFileSync(path.join(__dirname, 'data', filename), line)
    })
    res.download(filepath, filename)
  })
}
