
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

function swift_url() {
    var path = window.location.pathname;
    var parts = path.split('/');
    while (parts.length > 3) {
        parts.pop();
    }
    return parts.join('/');
}

function list_objects(container, opts, success) {
    var param = $.param(opts);
    var url = swift_url() + '/' + container + '?' + param;
    return $.getJSON(url, success);
}

function list_containers(opts, success) {
    var param = $.param(opts);
    var url = swift_url() + '/?' + param;
    return $.getJSON(url, success);
}

function load_videos(container, opts, success) {
    list_objects(container, opts, function (data, status, xhr) {
        var count = xhr.getResponseHeader('X-Container-Object-Count');
        if (count) {
            $('#count').text(count);
        }
        if (data.length == 0) {
            return (success || $.noop)({videos: []}, true, true);
        } else {
            var first = data[0].name;
            var last = data[data.length - 1].name;
            var prev = list_objects(container, {limit: 1, end_marker: first});
            var next = list_objects(container, {limit: 1, marker: last});

            videos = $.map(data, function (obj) {
                return {name: obj.name};
            });
            $.when(prev, next).then(function (a_prev, a_next) {
                var first = a_prev[0].length == 0;
                var last = a_next[0].length == 0;
                return (success || $.noop)({videos: videos}, first, last);
            });
        }
    });
}

function page_videos(element, direction) {
    var videos = element.find('.video');
    var opts = {limit: 6, marker: null, end_marker: null};
    if (videos.length > 0) {
        if (direction == 'prev') {
            var video = videos[0];
            opts.end_marker = $(video).data('name');
        } else {
            var video = videos[videos.length - 1];
            opts.marker = $(video).data('name');
        }
    }

    load_videos(element.data('container'), opts, function (videos, first, last) {
        log('Loaded', videos.videos.length, 'videos');
        var template = element.data('template');
        var html = template(videos);
        element.html(html);
        load_video_data(element);
        element.data('prev')[first ? 'addClass' : 'removeClass']('disabled');
        element.data('next')[last ? 'addClass' : 'removeClass']('disabled');
    });
}

function update_job_input(base_job, container, name) {
    var job = JSON.parse(JSON.stringify(base_job));  // clone job
    var path = 'swift://~/' + container + '/' + name;
    var devices = job[0].file_list;
    for (i = 0; i < devices.length; i++) {
        if (devices[i].device == "input") {
            devices[i].path = path;
            return job;
        }
    };
}

function loop_dots(next) {
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
    dots.queue(loop_dots);
    next();
}

function start_loading_animation(elm) {
    var dots = elm.children('.dots');
    for (i = 0; i < 3; i++) {
        dots.append($('<span>').text('.').hide());
    }
    dots.queue(loop_dots);
}

function stop_loading_animation(elm) {
    elm.children('.dots').finish();
    elm.fadeOut();
}

function load_video_data(elm) {
    var client = new ZeroCloudClient();
    var opts = {version: "0.0", swiftUrl: swift_url()};
    var meta = swift_url() + '/video-browser/extract-meta/extract-meta.json';
    var thumb = swift_url() + '/video-browser/extract-thumbnail/extract-thumbnail.json';
    var prefix = swift_url() + '/' + elm.data('container');
    var container = elm.data('container');

    client.auth(opts, function () {
        var meta_job = $.getJSON(meta);
        var thumb_job = $.getJSON(thumb);

        elm.find('.video').each(function (i, video) {
            var name = $(video).data('name');
            var title = $(video).children('.title');
            var loading = $(video).find('.loading');
            start_loading_animation(loading);

            var ajax_opts = {method: 'HEAD', cache: false};
            var q = $.ajax(prefix + '/' + name, ajax_opts);

            q.then(function (data, status, xhr) {
                log('Swift - loaded metadata for', name);
                var text = xhr.getResponseHeader('X-Object-Meta-Title');
                if (text) {
                    log('Found title for', name, 'in Swift');
                    title.text(text);
                    title.addClass('updated');
                } else {
                    meta_job.then(function (base_job) {
                        job = update_job_input(base_job, container, name);
                        log('Loading title for', name, 'with ZeroVM');
                        client.execute(job, function (result) {
                            result = ini_parse(result);
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
                    stop_loading_animation(loading);
                    log('Swift - loaded thumbnail URL for', name);
                } else {
                    thumb_job.then(function (base_job) {
                        job = update_job_input(base_job, container, name);
                        client.execute(job, function (result) {
                            var flat = result.replace(/\n/g, '');
                            $(video).css('background-image',
                                         'url("data:image/png;base64,' + flat + '")');
                            stop_loading_animation(loading);
                            log('ZeroVM - extracted thumbnail for', name);
                        });
                    });
                };
            });
        });
    });
}

function ini_parse(data) {
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
