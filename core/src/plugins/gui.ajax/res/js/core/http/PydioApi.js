'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var PydioApi = (function () {
    function PydioApi() {
        _classCallCheck(this, PydioApi);

        this._secureToken = '';
    }

    _createClass(PydioApi, [{
        key: 'setPydioObject',
        value: function setPydioObject(pydioObject) {
            this._pydioObject = pydioObject;
            this._baseUrl = pydioObject.Parameters.get('serverAccessPath');
            this._secureToken = pydioObject.Parameters.get('SECURE_TOKEN');
        }
    }, {
        key: 'setSecureToken',
        value: function setSecureToken(token) {
            this._secureToken = token;
        }
    }, {
        key: 'request',
        value: function request(parameters) {
            var onComplete = arguments[1] === undefined ? null : arguments[1];
            var onError = arguments[2] === undefined ? null : arguments[2];
            var settings = arguments[3] === undefined ? {} : arguments[3];

            parameters.secure_token = this._secureToken;
            if (window.Connexion) {
                var c = new Connexion();
                c.setParameters($H(parameters));
                if (settings.method) {
                    c.setMethod(settings.method);
                }
                c.onComplete = onComplete;
                if (settings.async === false) {
                    c.sendSync();
                } else {
                    c.sendAsync();
                }
            } else if (window.jQuery) {
                jQuery.ajax(this._baseUrl, {
                    method: settings.method || 'post',
                    data: parameters,
                    async: settings && settings.async !== undefined ? settings.async : true,
                    complete: onComplete,
                    error: onError
                });
            }
        }
    }, {
        key: 'switchRepository',
        value: function switchRepository(repositoryId, completeCallback) {
            var params = {
                get_action: 'switch_repository',
                repository_id: repositoryId
            };
            this.request(params, completeCallback);
        }
    }, {
        key: 'switchLanguage',
        value: function switchLanguage(lang, completeCallback) {
            var params = {
                get_action: 'get_i18n_messages',
                lang: lang,
                format: 'json'
            };
            this.request(params, completeCallback);
        }
    }, {
        key: 'loadXmlRegistry',
        value: function loadXmlRegistry(completeCallback) {
            var xPath = arguments[1] === undefined ? null : arguments[1];

            var params = { get_action: 'get_xml_registry' };
            if (xPath) params[xPath] = xPath;
            this.request(params, completeCallback);
        }
    }, {
        key: 'getBootConf',
        value: function getBootConf(completeCallback) {
            var params = { get_action: 'get_boot_conf' };
            var cB = (function (transport) {
                if (transport.responseJSON && transport.responseJSON.SECURE_TOKEN) {
                    this._pydioObject.Parameters.set('SECURE_TOKEN', transport.responseJSON.SECURE_TOKEN);
                    this.setSecureToken(transport.responseJSON.SECURE_TOKEN);
                }
                if (completeCallback) {
                    completeCallback(transport);
                }
            }).bind(this);
            this.request(params, cB);
        }
    }, {
        key: 'userSavePreference',
        value: function userSavePreference(prefName, prefValue) {
            var conn = new Connexion();
            conn.setMethod('post');
            conn.discrete = true;
            conn.addParameter('get_action', 'save_user_pref');
            conn.addParameter('pref_name_' + 0, prefName);
            conn.addParameter('pref_value_' + 0, prefValue);
            conn.sendAsync();
        }
    }, {
        key: 'userSavePreferences',
        value: function userSavePreferences(preferences, completeCallback) {
            var conn = new Connexion();
            conn.addParameter('get_action', 'save_user_pref');
            var i = 0;
            preferences.forEach(function (value, key) {
                conn.addParameter('pref_name_' + i, key);
                conn.addParameter('pref_value_' + i, value);
                i++;
            });
            conn.onComplete = completeCallback;
            conn.sendAsync();
        }
    }, {
        key: 'userSavePassword',
        value: function userSavePassword(oldPass, newPass, seed, completeCallback) {
            var conn = new Connexion();
            conn.addParameter('get_action', 'save_user_pref');
            conn.addParameter('pref_name_' + i, 'password');
            conn.addParameter('pref_value_' + i, newPass);
            conn.addParameter('crt', oldPass);
            conn.addParameter('pass_seed', seed);
            conn.onComplete = completeCallback;
            conn.sendAsync();
        }
    }, {
        key: 'applyCheckHook',
        value: function applyCheckHook(node, hookName, hookArg, completeCallback) {
            var params = {
                get_action: 'apply_check_hook',
                file: node.getPath(),
                hook_name: hookName,
                hook_arg: hookArg
            };
            this.request(params, completeCallback, null, { async: false });
        }
    }, {
        key: 'parseXmlMessage',

        /**
         * Standard parser for server XML answers
         * @param xmlResponse DOMDocument
         */
        value: function parseXmlMessage(xmlResponse) {
            if (xmlResponse == null || xmlResponse.documentElement == null) {
                return null;
            }var childs = xmlResponse.documentElement.childNodes;

            var reloadNodes = [];
            var error = false;
            this.LAST_ERROR_ID = null;

            for (var i = 0; i < childs.length; i++) {
                if (childs[i].tagName == 'message') {
                    var messageTxt = 'No message';
                    if (childs[i].firstChild) messageTxt = childs[i].firstChild.nodeValue;
                    if (childs[i].getAttribute('type') == 'ERROR') {
                        Logger.error(messageTxt);
                        error = true;
                    } else {
                        Logger.log(messageTxt);
                    }
                } else if (childs[i].tagName == 'prompt') {

                    var message = XMLUtils.XPathSelectSingleNode(childs[i], 'message').firstChild.nodeValue;
                    var jsonData = XMLUtils.XPathSelectSingleNode(childs[i], 'data').firstChild.nodeValue;
                    var json = JSON.parse(jsonData);
                    // TODO: DELEGATE TO UI
                    /*
                    var dialogContent = new Element('div').update(json["DIALOG"]);
                    modal.showSimpleModal(modal.messageBox?modal.messageBox:document.body, dialogContent, function(){
                        // ok callback;
                        if(json["OK"]["GET_FIELDS"]){
                            var params = $H();
                            $A(json["OK"]["GET_FIELDS"]).each(function(fName){
                                params.set(fName, dialogContent.down('input[name="'+fName+'"]').getValue());
                            });
                            var conn = new Connexion();
                            conn.setParameters(params);
                            if(json["OK"]["EVAL"]){
                                conn.onComplete = function(){
                                    eval(json["OK"]["EVAL"]);
                                };
                            }
                            conn.sendAsync();
                        }else{
                            if(json["OK"]["EVAL"]){
                                eval(json["OK"]["EVAL"]);
                            }
                        }
                        return true;
                    }, function(){
                        // cancel callback
                        if(json["CANCEL"]["EVAL"]){
                            eval(json["CANCEL"]["EVAL"]);
                        }
                        return true;
                    });
                    */
                    throw new Error();
                } else if (childs[i].tagName == 'reload_instruction') {
                    var obName = childs[i].getAttribute('object');
                    if (obName == 'data') {
                        var node = childs[i].getAttribute('node');
                        if (node) {
                            reloadNodes.push(node);
                        } else {
                            var file = childs[i].getAttribute('file');
                            if (file) {
                                this._pydioObject.getContextHolder().setPendingSelection(file);
                            }
                            reloadNodes.push(this._pydioObject.getContextNode());
                        }
                    } else if (obName == 'repository_list') {
                        this._pydioObject.reloadRepositoriesList();
                    }
                } else if (childs[i].nodeName == 'nodes_diff') {
                    var dm = this._pydioObject.getContextHolder();
                    if (dm.getAjxpNodeProvider().parseAjxpNodesDiffs) {
                        dm.getAjxpNodeProvider().parseAjxpNodesDiffs(childs[i], dm, !window.currentLightBox);
                    }
                } else if (childs[i].tagName == 'logging_result') {
                    if (childs[i].getAttribute('secure_token')) {
                        var serverAccessPath = this._pydioObject.Parameters.get('ajxpServerAccess');
                        var regex = new RegExp('.*?[&\\?]' + 'minisite_session' + '=(.*?)&.*');

                        var val = serverAccessPath.replace(regex, '$1');
                        var minisite_session = val == serverAccessPath ? false : val;

                        var secure_token = childs[i].getAttribute('secure_token');

                        var parts = serverAccessPath.split('?secure_token');
                        serverAccessPath = parts[0] + '?secure_token=' + secure_token;
                        if (minisite_session) serverAccessPath += '&minisite_session=' + minisite_session;

                        this.setSecureToken(secure_token);
                        this._pydioObject.Parameters.set('SECURE_TOKEN', secure_token);
                        // BACKWARD COMPAT
                        window.ajxpServerAccessPath = serverAccessPath;
                        this._pydioObject.Parameters.set('ajxpServerAccess', serverAccessPath);
                        if (window.ajxpBootstrap && ajxpBootstrap.parameters) {
                            ajxpBootstrap.parameters.set('ajxpServerAccess', serverAccessPath);
                            ajxpBootstrap.parameters.set('SECURE_TOKEN', secure_token);
                        }
                        if (window.Connexion) Connexion.SECURE_TOKEN = secure_token;
                    }
                    var result = childs[i].getAttribute('value');
                    var errorId = false;
                    if (result == '1') {
                        try {} catch (e) {
                            Logger.error('Error after login, could prevent registry loading!', e);
                        }
                        this._pydioObject.loadXmlRegistry();
                    } else if (result == '0' || result == '-1') {
                        errorId = 285;
                    } else if (result == '2') {
                        this._pydioObject.loadXmlRegistry();
                    } else if (result == '-2') {
                        errorId = 285;
                    } else if (result == '-3') {
                        errorId = 366;
                    } else if (result == '-4') {
                        errorId = 386;
                    }
                    if (errorId) {
                        error = true;
                        this.LAST_ERROR_ID = errorId;
                        Logger.error(this._pydioObject.MessageHash[errorId]);
                    }
                } else if (childs[i].tagName == 'trigger_bg_action') {
                    var name = childs[i].getAttribute('name');
                    var messageId = childs[i].getAttribute('messageId');
                    var parameters = {};
                    for (var j = 0; j < childs[i].childNodes.length; j++) {
                        var paramChild = childs[i].childNodes[j];
                        if (paramChild.tagName == 'param') {
                            parameters[paramChild.getAttribute('name')] = paramChild.getAttribute('value');
                        }
                    }
                    var bgManager = this._pydioObject.getController().getBackgroundTasksManager();
                    if (bgManager) {
                        bgManager.queueAction(name, parameters, messageId);
                        bgManager.next();
                    }
                }
            }
            if (reloadNodes.length) {
                this._pydioObject.getContextHolder().multipleNodesReload(reloadNodes);
            }
            return !error;
        }
    }, {
        key: 'submitForm',

        /**
         * Submits a form using Connexion class.
         * @param formName String The id of the form
         * @param post Boolean Whether to POST or GET
         * @param completeCallback Function Callback to be called on complete
         */
        value: function submitForm(formName, post, completeCallback) {
            var params = {};
            // TODO: UI IMPLEMENTATION
            $(formName).getElements().each(function (fElement) {
                var fValue = fElement.getValue();
                if (fElement.name == 'get_action' && fValue.substr(0, 4) == 'http') {
                    fValue = getBaseName(fValue);
                }
                if (fElement.type == 'radio' && !fElement.checked) return;
                if (params[fElement.name] && fElement.name.endsWith('[]')) {
                    var existing = params[fElement.name];
                    if (typeof existing == 'string') existing = [existing];
                    existing.push(fValue);
                    params[fElement.name] = existing;
                } else {
                    params[fElement.name] = fValue;
                }
            });
            if (this._pydioObject.getContextNode()) {
                params.dir = this._pydioObject.getContextNode().getPath();
            }
            var onComplete;
            if (completeCallback) {
                onComplete = completeCallback;
            } else {
                onComplete = (function (transport) {
                    this.parseXmlMessage(transport.responseXML);
                }).bind(this);
            }
            this.request(params, onComplete, null, { method: post ? 'post' : 'get' });
        }
    }, {
        key: 'triggerDownload',

        /**
         * Trigger a simple download
         * @param url String
         */
        value: function triggerDownload(url) {
            document.location.href = url;
        }
    }], [{
        key: 'getClient',
        value: function getClient() {
            if (PydioApi._PydioClient) {
                return PydioApi._PydioClient;
            }var client = new PydioApi();
            PydioApi._PydioClient = client;
            return client;
        }
    }, {
        key: 'loadLibrary',

        /**
         * Load a javascript library
         * @param fileName String
         * @param onLoadedCode Function Callback
         * @param aSync Boolean load library asynchroneously
         * @todo : We should use Require or equivalent instead.
         */
        value: function loadLibrary(fileName, onLoadedCode, aSync) {
            if (window.pydio && pydio.Parameters.get('ajxpVersion') && fileName.indexOf('?') == -1) {
                fileName += '?v=' + pydio.Parameters.get('ajxpVersion');
            }
            PydioApi._libUrl = false;
            if (window.pydio && pydio.Parameters.get('SERVER_PREFIX_URI')) {
                PydioApi._libUrl = pydio.Parameters.get('SERVER_PREFIX_URI');
            }
            var path = PydioApi._libUrl ? PydioApi._libUrl + '/' + fileName : fileName;

            /*if(window.jQuery && window.jQuery.ajax){
                jQuery.ajax(path,
                    {
                        method:'get',
                        async: (aSync?true:false),
                        complete:function(transport){
                            if(transport.responseText)
                            {
                                try
                                {
                                    var script = transport.responseText;
                                    if (window.execScript){
                                        window.execScript( script );
                                    }
                                    else{
                                        // TO TEST, THIS SEEM TO WORK ON SAFARI
                                        window.my_code = script;
                                        var script_tag = document.createElement('script');
                                        script_tag.type = 'text/javascript';
                                        script_tag.innerHTML = 'eval(window.my_code)';
                                        document.getElementsByTagName('head')[0].appendChild(script_tag);
                                    }
                                    if(onLoadedCode != null) onLoadedCode();
                                }
                                catch(e)
                                {
                                    alert('error loading '+fileName+':'+ e.message);
                                }
                            }
                            pydio.fire("server_answer");
                        }
                    });
            }else */if (window.Connexion) {

                var conn = new Connexion();
                conn._libUrl = false;
                if (pydio.Parameters.get('SERVER_PREFIX_URI')) {
                    conn._libUrl = pydio.Parameters.get('SERVER_PREFIX_URI');
                }
                conn.loadLibrary(fileName, onLoadedCode, aSync);
            }
        }
    }]);

    return PydioApi;
})();

/*
TODO: REMEMBER COOKIE STUFF
if(childs[i].getAttribute('remember_login') && childs[i].getAttribute('remember_pass')){
    var login = childs[i].getAttribute('remember_login');
    var pass = childs[i].getAttribute('remember_pass');
    storeRememberData(login, pass);
}
*/