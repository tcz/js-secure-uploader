## Introduction ##

Js-secure-uploader is a framework-independent Javascript library that allows you to upload files to a remote server with client-side integrity checking.

It works with the latest HTML5 technologies (File API, Web workers) therefore its browser support is very limited, currently only works with Chrome.

It is capable to upload really big files to be combined on server side. It is because js-secure-uploader creates small chunks of the files, and calculates hash for each (and the entire file too).

At the moment only SHA1 hash is supported, but in the future other integrity checking methods (CRC32, MD5) are coming.

For usage hint see examples. If you happen to miss the comment in the PHP example: DON'T use it in production.

## Things that are missing ##

...but will come soon.

- Firefox support

Once this bug is fixed in FF, it should work there too: https://bugzilla.mozilla.org/show_bug.cgi?id=667388
It is a crappy issue with File object serialization when passed to Workers. Chrome solved this without problems. Try harder Mozilla.

- Optimizations

“The First Rule of Program Optimization: Don't do it. The Second Rule of Program Optimization (for experts only!): Don't do it yet.” - Michael A. Jackson

I am currently in the "yet" phase.

- More hash algorithms - you can open issues if you need any. CRC32 and MD5 are planned.

- More tests - if js-test-driver was not so buggy, I could have written all the tests for all objects. But it is buggy.

- Robustness - error handlng is definitely missing in some places

- More events of the object, better communication with the rest of the JS code (onsuccess, onerror, onprogress...)

## License ##

Js-secure-uploader comes for free, open-sourced, with the new (3 clause) BSD license that you can read in the LICENSE file.

## FAQ ##

> "Why should I need "client-side integrity checking" ? I already have a CRC on Ethernet and TCP."
> "Because data link is only one layer out of the 7 according to the OSI model, not to mention procedures that are out of the scope of the network transfer (moving file, etc)."