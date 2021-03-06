let Article = require('../models/article')
let Email = require('../models/email')
let AEmap = require('../models/article_email')
let async = require('async')
let nodemailer = require('nodemailer')

let schedule = require('node-schedule')

let argv = process.argv.slice(2);

let pass;
if (argv.length > 1) {
  pass = argv[0];
} else {
  throw new Error('请输入密码和数据库地址。');
}

let trigger

let send = function (num) {
  console.log('=> => => => => => => => => => => => => => => => => =>')
  console.log('=> => => => => => => => => => => => => => => => => =>')
  console.log('=> => => => => => => => => => => => => => => => => =>')
  console.log('start sending email, now trigger is ', trigger)
  async.waterfall([
    function (cb) {
      let timeout = Math.random() + 1;
      setTimeout(function () {
        console.log('本次发送延迟', timeout, '分钟');
        cb(null, timeout)
      }, 1000 * 60 * timeout);
    },
    function (timeout, cb) {
      Article.findOne({ status: 1 }, {}, function (err, article) {
        if (err) {
          trigger = 0
          console.log(err)
          // console.log('=> => => => => => => => =>')
          // console.log('20 sending email...')
          send(num)
        } else {
          if (article !== null) {
            cb(null, article)
          } else {
            trigger = -1
            console.log('================================================')
            console.log('================================================')
            console.log('================================================')
            console.log('now trigger is ', trigger)
            console.log('29 sending email...')
            console.log('articles all sended.')
          }
        }
      })
    },
    function (article, cb) {
      AEmap.find({ articleId: article._id }, {}, function (err, maps) {
        if (err) {
          trigger = 0
          console.log(err)
          // console.log('=> => => => => => => => =>')
          // console.log('40 sending email...')
          send(num)
        } else {
          let emailIds = []
          maps.map(function (data) {
            emailIds.push(data.emailId)
          })
          cb(null, article, emailIds)
        }
      })
    },
    function (article, emailIds, cb) {
      Email.find({ _id: { '$nin': emailIds }, status: 1 }, {}, { limit: num }, function (err, emails) {
        if (err) {
          trigger = 0
          console.log(err)
          // console.log('=> => => => => => => => =>')
          // console.log('57 sending email...')
          send(num)
        } else {
          if (emails.length > 0) {
            cb(null, article, emails)
          } else {
            Article.findOne({ _id: article._id }, {}, function (err, article) {
              if (err) {
                trigger = 0
                console.log(err)
                // console.log('=> => => => => => => => =>')
                // console.log('68 sending email...')
                send(num)
              } else {
                if (article === null) {
                  // console.log('exits error.')
                  // console.log('=> => => => => => => => =>')
                  // console.log('74 sending email...')
                  send(num)
                } else {
                  article.status = 0
                  article.save(function (err) {
                    if (err) {
                      console.log(err)
                    }
                    trigger = 0
                    console.log('================================================')
                    console.log('84 this article sended...')
                    send(num)
                  })
                }
              }
            })
          }
        }
      })
    }
  ], function (err, article, emails) {
    trigger = emails.length
    emails.map(function (email) {
      // create reusable transporter object using the default SMTP transport
      let transporter = nodemailer.createTransport({
        "host": "smtpdm.aliyun.com",
        "port": 25,
        "secureConnection": true, // use SSL
        "auth": {
          "user": 'newsletter@netranking.com.cn', // user name
          "pass": pass         // password
        },
        "logger": true
      })
      let {title, content, filename, path} = article
      let address = email.address
      let html = '<p>' + content.split('\r\n').join('</p><p>') + '</p>'
      let mailOptions

      if (filename && path) {
        // setup e-mail data with unicode symbols
        mailOptions = {
          from: '"newsletter" <newsletter@netranking.com.cn>', // sender address
          to: address, // list of receivers
          subject: title, // Subject line
          text: title, // plaintext body
          html: html, // html body
          attachments: [{
            filename: filename,
            path: path
          }]
        }
      } else {
        mailOptions = {
          from: '"newsletter" <newsletter@netranking.com.cn>', // sender address
          to: address, // list of receivers
          subject: title, // Subject line
          text: title, // plaintext body
          html: html // html body
          // html: content
        }
      }

      // console.log(mailOptions)
      //send mail with defined transport object
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          trigger--
          console.log(error)
          if (error.responseCode == 552) {
            console.log('=> => => => => => => => =>')
            console.log('=> => => => => => => => =>')
            console.log('=> => => => => => => => =>')
            console.log('142 email quota exceeded...')
            console.log('email will send tomorrow 0 am...')
            let rule = new schedule.RecurrenceRule()
            let timer = schedule.scheduleJob('0 0 0 */1 * *', function () {
              send(1)
              timer.cancel()
            })
          } else {
            console.log('=> => => => => => => => =>')
            console.log('sending email exits error...')
            console.log(mailOptions.to)
            console.log(error.response);
            console.log('sending email exits error...')
            Email.findOne({ _id: email._id }, function (err, result) {
              if (!err && result !== null) {
                result.status = 0
                result.errorReason = error.response
                result.updatedAt = Date.now()
                result.save(function (err) {
                  if (err) {
                    console.log(err)
                  }
                  send(1)
                })
              }
            })
          }
        } else {
          console.log('=> => => => => => => => =>')
          console.log('sending email success...')
          console.log(mailOptions.to)
          console.log(info)
          console.log(info.response)
          Email.findOne({ _id: email._id }, function (err, result) {
            if (!err && result !== null) {
              result.errorReason = info.response
              result.save(function (err) {
                if (err) {
                  console.log(err)
                }
              })
            }
          })
          let articleId = article._id
          let emailId = email._id
          let _map = new AEmap({
            articleId: articleId,
            emailId: emailId,
            sendTime: Date.now()
          })
          _map.save(function () {
            if (err) {
              console.log(err)
            }
            trigger--
            // console.log('=> => => => => => => => =>')
            // console.log('168 sending email...')
            console.log('本次发送成功。');
            send(1)
          })
        }
      })
    })
  })
}

//发送邮件（新）
send(1)

exports.sender = function () {
  // console.log('=> => => => => => => => =>')
  // console.log('205 start send email...')
  console.log(trigger)
  console.log(typeof trigger)
  if (trigger === -1 || (typeof trigger === 'undefined')) {
    //articles all sended
    send(1)
  } else if (trigger >= 0) {
    //articles ending
    console.log('211 email sending...')
    console.log('now trigger is ', trigger)
  } else {
    console.log('214 error exits.');
    console.log('now trigger is ', trigger)
  }
}
