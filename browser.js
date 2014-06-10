
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

function load_videos(container, opts, success) {
    list_objects(container, opts, function (data) {
        if (data.length == 0) {
            return (success || $.noop)({'videos': []}, true, true);
        } else {
            var first = data[0].name;
            var last = data[data.length - 1].name;
            var prev = list_objects(container, {'limit': 1, 'end_marker': first});
            var next = list_objects(container, {'limit': 1, 'marker': last});

            videos = $.map(data, function (obj) {
                return {'name': obj.name};
            });
            $.when(prev, next).then(function (a_prev, a_next) {
                var first = a_prev[0].length == 0;
                var last = a_next[0].length == 0;
                return (success || $.noop)({'videos': videos}, first, last);
            });
        }
    });
}

function page_videos(element, direction) {
    var videos = element.find('.video');
    var opts = {'limit': 6, 'marker': null, 'end_marker': null};
    if (videos.length > 0) {
        if (direction == 'prev') {
            var video = videos[0];
            opts.end_marker = $(video).data('name');
        } else {
            var video = videos[videos.length - 1];
            opts.marker = $(video).data('name');
        }
    }

    load_videos(element.data('container'), opts, function (videos) {
        var template = element.data('template');
        var html = template(videos);
        element.html(html);
        load_titles(element);
        load_thumbnails(element);
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

function load_titles(elm) {
    var client = new ZeroCloudClient();
    var opts = {"version": "0.0", "swiftUrl": swift_url()};
    var extract = swift_url() + '/video-browser/extract-meta/extract-meta.json';
    var prefix = swift_url() + '/' + elm.data('container');
    var container = elm.data('container');

    client.auth(opts, function () {
        $.getJSON(extract, function (base_job) {
            elm.find('.video').each(function (i, video) {
                var name = $(video).data('name');
                var title = $(video).children('.title');
                title.addClass('pending');
                var ajax_opts = {method: 'HEAD', cache: false};
                var q = $.ajax(prefix + '/' + name, ajax_opts);
                q.then(function (data, status, xhr) {
                    title.removeClass('pending');
                    var text = xhr.getResponseHeader('X-Object-Meta-Title');
                    if (text) {
                        title.text(text);
                        title.addClass('updated swift');
                    } else {
                        job = update_job_input(base_job, container, name);
                        client.execute(job, function (result) {
                            $(video).removeClass('pending');
                            result = JSON.parse(result);
                            if (result.valid && result.title) {
                                title.text(result.title);
                                title.addClass('updated zerovm');
                            }
                        });
                    }
                });
            });
        });
    });
}

function load_thumbnails(elm) {
    var client = new ZeroCloudClient();
    var opts = {"version": "0.0", "swiftUrl": swift_url()};
    var extract = swift_url() + '/video-browser/extract-thumbnail/extract-thumbnail.json';
    var prefix = swift_url() + '/' + elm.data('container');
    var container = elm.data('container');

    client.auth(opts, function () {
        $.getJSON(extract, function (base_job) {
            elm.find('.video').each(function (i, video) {
                var name = $(video).data('name');
                var ajax_opts = {method: 'HEAD', cache: false};
                var q = $.ajax(prefix + '/' + name, ajax_opts);
                q.then(function (data, status, xhr) {
                    var thumb = xhr.getResponseHeader('X-Object-Meta-Thumbnail');
                    if (thumb) {
                        $(video).css('background-image', 'url(' + thumb + ')');
                    } else {
                        job = update_job_input(base_job, container, name);
                        client.execute(job, function (result) {
                            $(video).css('background-image',
                                         'url("data:image/png;base64,' + result.replace('\n', '', 'g') + '")');
                        });
                    }
                });
            });
        });
    });
}
