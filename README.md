video-browser
=============

[![Build Status](https://travis-ci.org/mgeisler/video-browser.svg?branch=master)](https://travis-ci.org/mgeisler/video-browser)
ZeroVM video browser demo application.

Screenshots
-----------

Because deploying this app requires some upfront work (you need to
install [Swift][swift] and [ZeroCloud][zerocloud]), we have created
[some screenshots][screenshots] to show you what it looks like.

Usage
-----

The video browser can be bundled and deployed with `zpm`:

    $ zpm bundle
    $ zpm deploy video-browser video-browser.zapp

Create a container called `videos` and upload some objects there
(currently only tested with MP4 files):

    $ swift upload videos *.mp4

You can download test movies from the [Internet Archive][1].

Now browse to the `index.html` page and it should show a listing of
the videos in your `videos` container.

You will see six videos at a time and you can page between them. For
each video, the JavaScript will first try to extract a title from the
metadata associated with the object in Swift (using the `title` key).
If that fails, it calls out to the `extract-meta` helper which then
tries to analyze the object.

Compatibility
-------------

After `d1b2fbb`, you need to use Internet Explorer 10, Firefox 28, or
Chrome 33 to see the extracted thumbnails. This is because the code
uses [XMLHttpRequest Level 2][2] features, such as setting
`responseType` to `blob` in order to directly retrieve the binary data
for the thumbnails.

[screenshots]: screenshots.md
[swift]: http://swift.openstack.org/
[zerocloud]: https://github.com/zerovm/zerocloud/

[1]: https://archive.org/details/movies
[2]: http://www.w3.org/TR/XMLHttpRequest2/
