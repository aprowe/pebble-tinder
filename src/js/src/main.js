var Tinder = {
	recs: [],
	facebookToken: '',
	token: '',
	currentRec: {},
	bufferSize: 440,
	currentImage: 0,

	init: function() {
		Tinder.facebookToken = localStorage.getItem('facebookToken');
		Tinder.token = localStorage.getItem('token');
		Tinder.refresh();
		setTimeout(function() { Keen.addEvent('init', { hasFacebookToken: (Tinder.facebookToken.length!==0), hasToken: (Tinder.token.length!==0) }); }, 100);
	},

	refresh: function() {
		if (!Tinder.token) return Tinder.auth(Tinder.refresh);
		Tinder.sendNextRecommendation();
		Tinder.ping();
	},

	error: function(error) {
		appMessageQueue.clear();
		appMessageQueue.send({type:TYPE.ERROR, name:error});
	},

	auth: function(cb) {
		Tinder.api.auth(function(xhr) {
			var res = JSON.parse(xhr.responseText);
			if (res.token) {
				Tinder.token = res.token;
				localStorage.setItem('token', Tinder.token);
				if (typeof(cb) === 'function') cb();
			}
		});
	},

	ping: function() {
		navigator.geolocation.getCurrentPosition(function(pos) {
			Tinder.api.ping(pos.coords.latitude, pos.coords.longitude, function(xhr) {
				console.log('ping: ' + xhr.responseText);
			});
		});
	},

	profile: function() {
		Tinder.api.profile(function(xhr) {
			var res = JSON.parse(xhr.responseText);
			console.log(JSON.stringify(res));
		});
	},

	sendImage: function(url) {
		var j = new JpegImage();
		j.onload = function() {
			var pixels = j.getData(j.width, j.height);
			var bitmap = convertImage(pixels, 3, j.width, j.height);
			appMessageQueue.send({type:TYPE.IMAGE, method:METHOD.BEGIN, index:bitmap.length});
			for (var i = 0; i < bitmap.length; i++) {
				var nextSize = Math.min(bitmap.length-i, Tinder.bufferSize);
				var sliced = bitmap.slice(i, i + nextSize);
				appMessageQueue.send({type:TYPE.IMAGE, method:METHOD.DATA, index:i, image:sliced});
				i += nextSize;
			}
			appMessageQueue.send({type:TYPE.IMAGE, method:METHOD.END});
		};
		j.load(url);
	},

	getRecs: function() {
		Tinder.api.recs(function(xhr) {
			if (xhr.responseText === 'recs timeout' || xhr.responseText === 'recs exhausted') {
				Keen.addEvent('recsExhausted', { statusCode: xhr.status, response: (xhr.responseText) });
				return Tinder.error('Fresh out of recommendations.\nPlease try again later.');
			}
			var res = JSON.parse(xhr.responseText);
			if (!res.results.length) return;
			Tinder.recs = Tinder.recs.concat(res.results);
			console.log('recs count: ' + Tinder.recs.length);
			Tinder.sendNextRecommendation();
		});
	},

	checkIfMatch: function (xhr) {
		var response = JSON.parse(xhr.responseText);
		if (response.match === true) {
			Tinder.sendMatchPage();
		} else {
			Tinder.sendNextRecommendation();
		}
	},

	sendMatchPage: function () {
		appMessageQueue.clear();
		appMessageQueue.send({type:TYPE.MATCH, name:"Matched!"});
	},

	sendNextRecommendation: function() {
		if (!Tinder.recs.length) return Tinder.getRecs();
		Tinder.currentRec = Tinder.recs.shift();

		var rec = {};
		rec.name = Tinder.currentRec.name + ', ' + getAge(Tinder.currentRec.birth_date) || '';
		rec.distance = Tinder.currentRec.distance_mi + ' miles away' || '';
		rec.bio = Tinder.currentRec.bio || '';
		rec.likes = Tinder.currentRec.common_like_count || 0;
		rec.friends = Tinder.currentRec.common_friend_count || 0;
		rec.url = getBestImage(Tinder.currentRec.photos[0].processedFiles);

		appMessageQueue.send({type:TYPE.REC, method:METHOD.DATA, name:rec.name, distance:rec.distance, commlikes:rec.likes, commfriends:rec.friends});
		appMessageQueue.send({type:TYPE.REC, method:METHOD.DATA, bio:rec.bio});

		Tinder.sendImage(rec.url);
	},

	like: function() {
		Tinder.api.like(Tinder.currentRec._id, Tinder.checkIfMatch);
	},

	pass: function() {
		Tinder.api.pass(Tinder.currentRec._id, Tinder.sendNextRecommendation);
	},

	getNextImage: function () {
		if (Tinder.currentImage + 1 >= Tinder.currentRec.photos.length) {
			Tinder.currentImage = 0;
		} else  {
			Tinder.currentImage++;
		}
		var url = getBestImage(Tinder.currentRec.photos[Tinder.currentImage].processedFiles);
		Tinder.sendImage(url);
	},

	api: {
		auth: function(cb, fb) {
			if (!Tinder.facebookToken) {
				return Tinder.error('Authentication error.\nPlease log in again.');
			}
			Tinder.api.makeRequest('POST', '/auth', JSON.stringify({facebook_token:Tinder.facebookToken}), cb, fb);
		},

		profile: function(cb, fb) {
			Tinder.api.makeRequest('GET', '/profile', null, cb, fb);
		},

		ping: function(lat, lon, cb, fb) {
			Tinder.api.makeRequest('POST', '/user/ping', JSON.stringify({lat:lat, lon:lon}), cb, fb);
		},

		updates: function(cb, fb) {
			Tinder.api.makeRequest('GET', '/updates', null, cb, fb);
		},

		recs: function(cb, fb) {
			Tinder.api.makeRequest('GET', '/user/recs', null, cb, fb);
		},

		like: function(id, cb, fb) {
			Tinder.api.makeRequest('GET', '/like/' + id, null, cb, fb);
		},

		pass: function(id, cb, fb) {
			Tinder.api.makeRequest('GET', '/pass/' + id, null, cb, fb);
		},

		makeRequest: function(method, endpoint, data, cb, fb) {
			if (!Tinder.token && endpoint != '/auth')
				return Tinder.error('Authentication error.\nPlease log in again.');
			try {
				var url = 'https://api.gotinder.com' + endpoint;
				if (method == 'GET' && data) {
					url += '?' + data;
					data = null;
				}
				console.log(method + ' ' + url + ' ' + data);
				var xhr = new XMLHttpRequest();
				xhr.open(method, url, true);
				xhr.setRequestHeader('X-Auth-Token', Tinder.token);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.onload = function() {
					if (xhr.status >= 300) {
						Keen.addEvent('requestOnload', { statusCode: xhr.status, hasToken: (Tinder.token.length!==0) });
						if (endpoint == '/auth') {
							return Tinder.error('Authentication error.\nPlease log in again.');
						} else {
							return Tinder.auth(Tinder.api.makeRequest(method, endpoint, data, cb, fb));
						}
					}
					if (typeof(cb) === 'function') cb(xhr);
				};
				xhr.onerror = function() { if (typeof(fb) === 'function') fb('HTTP error!'); Keen.addEvent('requestError', { endpoint: endpoint }); };
				xhr.ontimeout = function() { if (typeof(fb) === 'function') fb('Connection to Tinder API timed out!'); Keen.addEvent('requestTimeout', { endpoint: endpoint }); };
				xhr.timeout = 30000;
				xhr.send(data);
			} catch (e) {
				Tinder.error(e);
			}
		}

	},

	handleAppMessage: function(e) {
		console.log('AppMessage received: ' + JSON.stringify(e.payload));
		if (!e.payload.method) return;
		switch (e.payload.method) {
			case METHOD.REQUESTREC:
				Tinder.sendNextRecommendation();
				break;
			case METHOD.LIKE:
				Tinder.like();
				break;
			case METHOD.PASS:
				Tinder.pass();
				break;
			case METHOD.BUFFERSIZE:
				Tinder.bufferSize = e.payload.index - 128;
				break;
			case METHOD.NEXT_IMAGE:
				Tinder.getNextImage();
				break;
		}
	},

	showConfiguration: function() {
		Keen.addEvent('configuration', { hasFacebookToken: (Tinder.facebookToken.length!==0), hasToken: (Tinder.token.length!==0) });
		Pebble.openURL('http://docs.alexrowe.net/tinder/');
	},

	handleConfiguration: function(e) {
		console.log('configuration received: ' + JSON.stringify(e));
		if (!e.response) return;
		if (e.response === 'CANCELLED') return;
		var data = JSON.parse(decodeURIComponent(e.response));
		if (data.facebookToken) {
			Tinder.token = '';
			Tinder.facebookToken = data.facebookToken;
			localStorage.setItem('facebookToken', Tinder.facebookToken);
			Tinder.auth(Tinder.refresh);
		}
		Keen.addEvent('configurationClose', { hasFacebookToken: (Tinder.facebookToken.length!==0), hasToken: (Tinder.token.length!==0) });
	}
};

Pebble.addEventListener('ready', Tinder.init);
Pebble.addEventListener('appmessage', Tinder.handleAppMessage);
Pebble.addEventListener('showConfiguration', Tinder.showConfiguration);
Pebble.addEventListener('webviewclosed', Tinder.handleConfiguration);
