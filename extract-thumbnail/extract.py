import os
import time
import json
import base64

if __name__ == '__main__':
    #path = sys.argv[1] if len(sys.argv) > 1 else '/dev/input'
    timestamp = float(os.environ.get('HTTP_X_TIMESTAMP', time.time()))

    thumbs = os.listdir('thumbnails')
    thumb = thumbs[int(100000 * timestamp) % len(thumbs)]

    out_data = open(os.path.join('thumbnails', thumb)).read()
    encoded = 'image/png;base64,' + base64.b64encode(out_data)
    print json.dumps({'valid': True, 'thumb': encoded})
