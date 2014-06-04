video-browser
=============

ZeroVM video browser demo application.

Usage
-----

You should upload the static files found in the root of the repository
using normal `swift upload`:

    $ swift upload video-browser *.html *.js *.css

Then bundle and deploy the `extract-meta` zapp:

    $ zpm bundle
    $ zpm deploy video-browser/extract-meta extract-meta.zapp

Create a container called `videos` and upload some objects there
(currently only tested with MP4 files):

    $ swift upload videos *.mp4

You can find a [sample file online][1].

Now browse to the `index.html` page and it should show a listing of
the videos in your `videos` container.

You will see six videos at a time and you can page between them. For
each video, the JavaScript will first try to extract a title from the
metadata associated with the object in Swift (using the `title` key).
If that fails, it calls out to the `extract-meta` helper which then
tries to analyze the object.

[1]: http://techslides.com/sample-webm-ogg-and-mp4-video-files-for-html5/
