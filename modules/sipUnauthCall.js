/*
Copyright Jesus Perez <jesusprubio gmail com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

var async  = require('async'),
    lodash = require('lodash'),

    SipFakeStack = require('../utils/sipFakeStack'),
    sipParser    = require('../utils/sipParser'),
    printer      = require('../utils/printer');


module.exports = (function () {

    var user = '100',
        pass = '100';

    return {

        info : {
            name : 'sipUnauthCall',
            description : 'To check if a server allows unauthenticated calls',
            options : {
                target : {
                    description  : 'IP address to attack',
                    defaultValue : '127.0.0.1',
                    type         : 'targetIp'
                },
                port : {
                    description  : 'Port to use',
                    defaultValue : 5060,
                    type         : 'port'
                },
                transport : {
                    description  : 'Underlying protocol',
                    defaultValue : 'UDP',
                    type         : 'protocols'
                },
                tlsType : {
                    description  : 'Version of TLS protocol to use (only when TLS)',
                    defaultValue : 'TLSv1',
                    type         : 'tlsType'
                },
                wsPath : {
                    description  : 'Websockets path (only when websockets)',
                    defaultValue : 'ws',
                    type         : 'anyValue'
                },
                fromExt : {
                    description  : 'Extension which makes the call',
                    defaultValue : 'range:100-110',
                    type         : 'userPass'
                },
                toExt : {
                    description  : 'Extension which receives the call',
                    defaultValue : 'range:100-110',
                    type         : 'userPass'
                },
                srcHost : {
                    description  : 'Source host to include in the  SIP request ("external" and "random" supported)',
                    defaultValue : 'iface:eth0',
                    type         : 'srcHost'
                },
                srcPort : {
                    description  : 'Source port to include in the  SIP request ("random" supported)',
                    defaultValue : 'real',
                    type         : 'srcPort'
                },
                domain : {
                    description  : 'Domain to explore ("ip" to use the target)',
                    defaultValue : 'ip',
                    type         : 'domainIp'
                },
                delay : {
                    description  : 'Delay between requests in ms.',
                    defaultValue : 0,
                    type         : 'positiveInt'
                },
                timeout : {
                    description  : 'Time to wait for a response (ms.)',
                    defaultValue : 5000,
                    type         : 'positiveInt'
                }
            }
        },

        run : function (options, callback) {
            var result         = { data : [] },
                indexCountFrom = 0, // User with delay to know in which index we are
                indexCountTo   = 0,
                stackConfig    = {
                    server    : options.target    || null,
                    port      : options.port      || '5060',
                    transport : options.transport || 'UDP',
                    timeout   : options.timeout   || 10000,
                    wsPath    : options.wsPath    || null,
                    tlsType   : options.tlsType   || 'TLSv1',
                    srcHost   : options.srcHost   || null,
                    lport     : options.srcPort   || null,
                    domain    : options.domain    || null
                };

            // We avoid to parallelize here to control the interval of the requests
            async.eachSeries(options.fromExt, function (fromExt, asyncCbFrom) {
                indexCountFrom += 1;
                indexCountTo = 0;
                async.eachSeries(options.toExt, function (toExt, asyncCbTo) {
                    // We use a new stack in each request to simulate different users
                    var msgConfig = {
                            meth    : 'INVITE',
                            fromExt : fromExt,
                            toExt   : toExt
                        },
                        fakeStack;

                    indexCountTo += 1;
                    fakeStack = new SipFakeStack(stackConfig);

                    // TODO: We need to be more polited here, an ACK and BYE
                    // is needed to avoid loops
                    fakeStack.send(msgConfig, function (err, res) {
                        var hasAuth       = true,
                            partialResult = {};

                        if (!err) {
                            var finalRes  = res.msg,
                                resCode   = sipParser.code(finalRes),
                                finalInfo = null;

                            if(['401', '407'].indexOf(resCode) !== -1) {
                                finalInfo = 'Auth enabled, not accepted';
                            } else if(resCode === '100') {
                                finalInfo = 'Accepted';
                            } else {
                                finalInfo = 'Auth disable, but not accepted, code: ' + resCode;
                            }

                            // We only add valid extensions to final result
                            if (finalInfo === 'Accepted') {
                                partialResult = {
                                    fromExt : fromExt,
                                    toExt   : toExt,
                                    info    : finalInfo,
                                    data    : res.msg
                                };
                                result.data.push(partialResult);
                                printer.highlight('Accepted: ' + fromExt + ' => ' + toExt );
                            } else {
                            // but we print info about tested ones
                                printer.infoHigh(finalInfo + ': ' + fromExt + ' => ' + toExt );
                            }
                            // Last element
                            if (indexCountFrom === options.fromExt.length &&
                                indexCountTo === options.toExt.length) {
                                asyncCbTo();
                            } else {
                                setTimeout(asyncCbTo, options.delay);
                            }
                        } else {
                            // We want to stop the full chain
                            asyncCbTo(err);
                        }
                    });
                }, function (err) {
                    asyncCbFrom(err);
                })
            }, function (err) {
                if (result.data.length === 0) {
                    result.vulnerable = false;
                } else {
                    result.vulnerable = true;
                }
                callback(err, result);
            });
        }
    };

}());
