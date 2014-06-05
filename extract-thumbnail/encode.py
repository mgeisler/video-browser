import base64
import sys

fp = open('/dev/in/extract')
sys.stdout.write(base64.encodestring(fp.read()))
