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

    SipFakeStack = require('../utils/sipFakeStack'),
    sipParser    = require('../utils/sipParser'),
    printer      = require('../utils/printer'),
    utils        = require('../utils/utils');


module.exports = (function () {

    return {

        info : {
            name        : 'sipTorture',
            description : 'SIP Torture stress test (crafted packets)',
            options     : {
                target : {
                    description  : 'IP address to brute-force',
                    defaultValue : '172.16.190.128',
                    type         : 'targetIp'
                },
                port : {
                    description  : 'Port of the server',
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
                    defaultValue : 'SSLv3',
                    type         : 'tlsType'
                },
                wsPath : {
                    description  : 'Websockets path (only when websockets)',
                    defaultValue : 'ws',
                    type         : 'anyValue'
                },
                srcHost : {
                    description  : 'Source host to include in the  SIP request',
                    defaultValue : 'random',
                    type         : 'targetIpRand'
                },
                srcPort : {
                    description  : 'Source port to include in the  SIP request',
                    defaultValue : 'random',
                    type         : 'portRand'
                },
                domain : {
                    description  : 'Domain to explore ("ip" to use the target)',
                    defaultValue : 'ip',
                    type         : 'domainIp'
                },
                timeout : {
                    description  : 'Time to wait for the first response, in ms.',
                    defaultValue : 5000,
                    type         : 'positiveInt'
                },
            }
        },

        run : function (options, callback) {
            var result      = {},
                // TODO: Add more
                // http://tools.ietf.org/html/rfc4475
                tortureCfgs = [
                    {
                        id           : '3121',
                        name         : 'Extraneous Header Field Separators',
                        meth         : 'INVITE',
                        badSeparator : true
                    },
                    {
                        id         : '3122',
                        name       : 'Content Length Larger Than Message',
                        meth       : 'INVITE',
                        contentLen : '99999'
                    },
                    {
                        id         : '3123',
                        name       : 'Negative Content Length',
                        meth       : 'INVITE',
                        contentLen : '-999'
                    },
                    {
                        id   : '3125',
                        name : 'Response Scalar Fields with Overlarge Values',
                        meth : 'INVITE',
                        cseq : '9292394834772304023312'
                    },
                    {
                        id      : '31212',
                        name    : 'Invalid Time Zone in Date Header Field',
                        meth    : 'INVITE',
                        sipDate : 'Fri, 01 Jan 2010 16:00:00 EST'
                    },
                    {
                        id         : '31216',
                        name       : 'Unknown Protocol Version',
                        meth       : 'INVITE',
                        sipVersion : '7.0'
                    },
                    {
                        id   : '31218',
                        name : 'Unknown method',
                        meth : 'NEWMETHOD'
                    },
                    {
                        id        : '331',
                        name      : 'Missing Required Header Fields',
                        meth      : 'INVITE',
                        badFields : true
                    },
                    {
                        id          : '336',
                        name        : 'Unknown Content-Type',
                        meth        : 'INVITE',
                        contentType : 'application/unknown'
                    },
                    {
                        id          : '3311',
                        name        : 'Max-Forwards of Zero',
                        meth        : 'INVITE',
                        maxForwards : '0'
                    },
                    {
                        id          : '3315',
                        name        : 'Unacceptable Accept Offering',
                        meth        : 'OPTIONS',
                        sipAccept   : 'text/nobodyKnowsThis'
                    }
                ];

            printer.infoHigh(options.target + ':' + options.port + ' / ' + options.transport);
            async.eachSeries(tortureCfgs, function (tortureCfg, asyncCb) {
                var stackConfig = {
                        server    : options.target    || null,
                        port      : options.port      || '5060',
                        transport : options.transport || 'UDP',
                        timeout   : options.timeout   || 10000,
                        wsPath    : options.wsPath    || null,
                        tlsType   : options.tlsType   || 'SSLv3',
                        srcHost   : options.srcHost   || null,
                        lport     : options.srcPort   || null,
                        domain    : options.domain    || null
                    },
                    fakeStack = new SipFakeStack(stackConfig),
                    msgConfig = tortureCfg,
                    vulnerable = false;

                printer.highlight(tortureCfg.name + ' test ...');

                fakeStack.send(msgConfig, function (err, res) {
                    result[tortureCfg.name] = {};
                    result[tortureCfg.name].id = tortureCfg.id;
                    result[tortureCfg.name].data = err || res;

                    asyncCb();
                });
            }, function (err) {
                callback(err, result);
            });
        }
    };

}());
