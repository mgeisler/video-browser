
function log() {
    var p = $('<p>');
    var now = new Date();
    p.append((now.getHours() < 10 ? '0' : '') + now.getHours(), ':',
             (now.getMinutes() < 10 ? '0' : '') + now.getMinutes(), ':',
             (now.getSeconds() < 10 ? '0' : '') + now.getSeconds(), ':');

    for (var i = 0; i < arguments.length; i++) {
        p.append(' ' + arguments[i]);
    }

    var l = $('#log');
    l.append(p);

    var pos = p.position();
    var diff = pos.top + p.height() - l.height();

    if (diff > 0) {
        l.scrollTop(l.scrollTop() + diff);
    }
}

function swiftUrl() {
    var path = window.location.pathname;
    var parts = path.split('/');
    while (parts.length > 3) {
        parts.pop();
    }
    return parts.join('/');
}

function listObjects(container, opts, success) {
    var param = $.param(opts);
    var url = swiftUrl() + '/' + container + '?' + param;
    return $.getJSON(url, success);
}

function listContainers(opts, success) {
    var param = $.param(opts);
    var url = swiftUrl() + '/?' + param;
    return $.getJSON(url, success);
}

function basename(path) {
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash != -1)
        path = path.slice(lastSlash + 1);
    return path;
}

function loadVideos(container, opts, success) {
    listObjects(container, opts, function (data, status, xhr) {
        var count = xhr.getResponseHeader('X-Container-Object-Count');
        if (count) {
            $('#count').text(count);
        }
        if (data.length == 0) {
            return (success || $.noop)({videos: []}, true, true);
        } else {
            var first = data[0].name;
            var last = data[data.length - 1].name;
            var prev = listObjects(container, {limit: 1, end_marker: first});
            var next = listObjects(container, {limit: 1, marker: last});

            videos = $.map(data, function (obj) {
                var path = container + '/' + encodeURIComponent(obj.name);
                return {
                    name: obj.name,
                    title: basename(obj.name),
                    src: swiftUrl() + '/' + path
                };
            });
            $.when(prev, next).then(function (aPrev, aNext) {
                var first = aPrev[0].length == 0;
                var last = aNext[0].length == 0;
                return (success || $.noop)({videos: videos}, first, last);
            });
        }
    });
}

function pageVideos(element, direction) {
    var videos = element.find('.video');
    var opts = {limit: 6, marker: null, end_marker: null};
    if (videos.length > 0) {
        if (direction == 'prev') {
            var firstVideo = videos[0];
            opts.end_marker = $(firstVideo).data('name');
        } else {
            var lastVideo = videos[videos.length - 1];
            opts.marker = $(lastVideo).data('name');
        }
    }

    loadVideos(element.data('container'), opts, function (videos, first, last) {
        log('Loaded', videos.videos.length, 'videos');
        var template = element.data('template');
        var html = template(videos);
        element.html(html);
        loadVideoData(element);
        element.data('prev')[first ? 'addClass' : 'removeClass']('disabled');
        element.data('next')[last ? 'addClass' : 'removeClass']('disabled');
    });
}

function showVideo(elm) {
    $('#player > video').attr('src', $(elm).data('src'));
    $('#player').fadeIn();
    $('#dimmer').fadeIn();
}

function addImageDevice(job) {
    var path = window.location.pathname;
    /* Remove "/v1/" prefix and "index.html" suffix */
    path = path.slice(4, path.lastIndexOf('/'));
    var swiftPath = 'swift://' + path + '/video-browser.zapp';
    job[0].file_list.push({device: 'image', path: swiftPath});
    return job;
}

function updateJobInput(baseJob, container, name) {
    var job = JSON.parse(JSON.stringify(baseJob));  // clone job
    var path = 'swift://~/' + container + '/' + name;
    var devices = job[0].file_list;
    for (i = 0; i < devices.length; i++) {
        if (devices[i].device == "input") {
            devices[i].path = path;
            return job;
        }
    }
}

function updateThumbJob(job, data) {
    /* Update the seek time in the thumbnail extraction job. */
    var args = job[0].exec.args;
    args = args.replace(/-ss\s*\d+/, "-ss " + data.seek);
    args = args.replace(/-s\s*\d+x\d+/, "-s " + data.size);
    job[0].exec.args = args;
}

function loopDots(next) {
    var duration = 200;
    var dots = $(this);
    dots.children().each(function (i, dot) {
        dots.queue(function (next) {
            $(dot).fadeIn();
            next();
        });
        dots.delay(duration);
    });
    dots.fadeOut();
    dots.delay(duration);
    dots.queue(function (next) {
        dots.children().hide();
        dots.show();
        next();
    });
    dots.queue(loopDots);
    next();
}

function startLoadingAnimation(elm) {
    var dots = elm.children('.dots');
    while (dots.children().length < 3) {
        dots.append($('<span>').text('.').hide());
    }
    dots.queue(loopDots);
    elm.fadeIn();
}

function stopLoadingAnimation(elm) {
    elm.children('.dots').finish();
    elm.fadeOut();
}

$.ajaxTransport("blob", function(options, originalOptions, jqXHR){
    if (window.FormData) {
        return {
            send: function(headers, completeCallback){
                var xhr = new XMLHttpRequest();
                xhr.addEventListener('load', function () {
                    var res = {};
                    res[options.dataType] = xhr.response;
                    completeCallback(xhr.status, xhr.statusText, res,
                                     xhr.getAllResponseHeaders());
                });
                xhr.open(options.type, options.url, options.async);
                xhr.responseType = options.dataType;
	        for (var key in headers) {
                    xhr.setRequestHeader(key, headers[key]);
                }
                xhr.send(options.data);
            },
            abort: function () {
                jqXHR.abort();
            }
        };
    }
});

function blobExecute(job, success) {
    var headers = {'X-Zerovm-Execute': '1.0'};
    return $.ajax({
        'type': 'POST',
        'url': swiftUrl(),
        'data': JSON.stringify(job),
        'headers': headers,
        'cache': false,
        'success': success,
        'contentType': 'application/json',
        'dataType': 'blob'
    });
}

function loadVideoData(elm) {
    var client = new ZeroCloudClient();
    var opts = {version: "0.0", swiftUrl: swiftUrl()};
    var meta = 'extract-meta.json';
    var thumb = 'extract-thumbnail.json';
    var prefix = swiftUrl() + '/' + elm.data('container');
    var container = elm.data('container');

    var widthHeight = elm.data('size').split('x');
    var videoWidth = widthHeight[0];
    var videoHeight = widthHeight[1];

    client.auth(opts, function () {
        var metaJob = $.getJSON(meta);
        var thumbJob = $.getJSON(thumb);

        elm.find('.video').each(function (i, video) {
            var name = $(video).data('name');
            var title = $(video).children('.title');
            var loading = $(video).find('.loading');
            startLoadingAnimation(loading);

            // Set the size of the videos the first time the page is
            // loaded.
            if ($(video).css('width') == '0px') {
                $(video).css({width: videoWidth, height: videoHeight});
            }

            var ajaxOpts = {method: 'HEAD', cache: false};
            var q = $.ajax(prefix + '/' + name, ajaxOpts);

            q.then(function (data, status, xhr) {
                log('Swift - loaded metadata for', name);
                var text = xhr.getResponseHeader('X-Object-Meta-Title');
                if (text) {
                    log('Found title for', name, 'in Swift');
                    title.text(text);
                    title.addClass('updated');
                } else {
                    metaJob.then(function (baseJob) {
                        job = updateJobInput(baseJob, container, name);
                        addImageDevice(job);
                        log('Loading title for', name, 'with ZeroVM');
                        client.execute(job, function (result) {
                            result = iniParse(result);
                            if (result.title) {
                                title.text(result.title);
                                title.addClass('updated');
                                log('ZeroVM - extracted title for', name);
                            }
                        });
                    });
                }

                var thumbUrl = xhr.getResponseHeader('X-Object-Meta-Thumbnail');
                if (thumbUrl) {
                    $(video).css('background-image', 'url(' + thumbUrl + ')');
                    stopLoadingAnimation(loading);
                    log('Swift - loaded thumbnail URL for', name);
                } else {
                    thumbJob.then(function (baseJob) {
                        job = updateJobInput(baseJob, container, name);
                        addImageDevice(job);
                        updateThumbJob(job, elm.data());
                        return job;
                    }).then(blobExecute).then(function (blob) {
                        var url = URL.createObjectURL(blob);
                        $(video).animate({width: videoWidth,
                                          height: videoHeight},
                                         'fast');
                        $(video).css('background-image', 'url("' + url + '")');
                        setTimeout(URL.revokeObjectURL, 100, url);
                        stopLoadingAnimation(loading);
                        log('ZeroVM - extracted thumbnail for', name);
                    });
                }
            });
        });
    });
}

function iniParse(data) {
    var result = {};
    var section = null;
    $.each(data.split('\n'), function (i, line) {
        if (!line || line.charAt(0) == ';')
            return true;
        if (line.charAt(0) == '[') {
            section = line.substr(1, line.length - 2);
            return true;
        }
        var keyvalue = line.split('=', 2);
        var key = keyvalue[0];
        if (section)
            key = section + '.' + key;
        result[key] = keyvalue[1];
    });
    return result;
}
