import sys
import json
from hsaudiotag import auto


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else '/dev/input'
    meta = auto.File(path)
    print json.dumps({'valid': meta.valid,
                      'title': meta.title})
