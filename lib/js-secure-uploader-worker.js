/**
 * @fileOverview Code of web worker thead used for file reading and  hash calculation.
 * @author Zoltan Toth-Czifra
 * @license New (3 clause) BSD license - see LICENSE file.
 *
 * Copyright (C) Zoltan Toth-Czifra
 */


// If Sha1 object is not present in a combined JS, we include it.
// @todo Support more hashing algorithms.
if ( "undefined" === typeof Sha1 )
{
    importScripts( 'hashes/sha1.js' );
}

/**
 * Sha1 object used for hash calculation (included in package).
 *
 * This is used globally for the whole file and not the chunk.
 * Its result is sent with the last chunk.
 *
 * @requires Sha1
 */
var oSha1Whole        = new Sha1();

/**
 * Events handler for when the thread is messaged.
 *
 * @param {object} oEvent Object containing data sent from other theads (data attribute).
 */
self.addEventListener('message', function( oEvent )
{
    var oSha1Chunk       = new Sha1();
    var oFile            = oEvent.data.file;
    var nFileSize        = oEvent.data.file.size;
    var nChunkSize       = oEvent.data.chunkSize;
    var nOffset          = oEvent.data.offset;
    var bLast            = oEvent.data.last;
    var oChunk           = sliceFile ( oFile, nOffset, nChunkSize );
    var sHash;
    var oResponse;

    // We need this callback because Firefox does not support sync file reading.
    // Chrome does. We hide this infomation in the readChunk function.
    readChunk( oChunk, function( sBinary )
    {
        // Feeding chunk hash.
        oSha1Chunk.feed( sBinary, false );
        // Feeding file hash.
        oSha1Whole.feed( sBinary, false );

        sHash = oSha1Chunk.finalize();

        oResponse = {
            "offset"    : nOffset,
            "size"      : Math.min( nChunkSize, ( nFileSize - nOffset ) ),
            "binary"    : sBinary,
            "hash"      : sHash
        };

        // If it's the last piece, we give the overall hash and size too.
        if ( bLast )
        {
            oResponse["entire_size"] = nFileSize;
            oResponse["entire_hash"] = oSha1Whole.finalize();
        }

        postMessage( oResponse );
    } );
});

/**
 * Slices a file object to a blob from a certain offset with a certain length.
 *
 * Webkit browsers don't implement the standard slice method, so we need this function.
 *
 * @param {object} oFile File object from file input.
 * @param {number} nOffset Offset in the file in bytes telling the first byte.
 * @param {number} nLength LEngth of the blob.
 * @return {object} Blob object with the slice.
 */
var sliceFile = function( oFile, nOffset, nLength )
{
    if ( "undefined" === typeof oFile.slice && "undefined" !== typeof oFile.webkitSlice )
    {
        // We are in Chrome.
        sliceFile = function( oFile, nOffset, nLength )
        {
            // Note the 2nd parameter is not length but end offset.
            return oFile.webkitSlice( nOffset, nOffset + nLength );
        }
    }
    else
    {
        // We use the standard way.
        sliceFile = function( oFile, nOffset, nLength )
        {
            return oFile.slice( nOffset, nLength );
        }
    }

    return sliceFile( oFile, nOffset, nLength );
}

/**
 * Wrapper around synchronous and asynchronous file reading methods.
 *
 * Not all browsers support the preferrred synchronous file reading so we
 * need to trick with callbacks.
 *
 * @param {object} oChunk Blog object of the file chunk to read.
 * @param {callback} fpCallback Function to call with the binary input when reading is finished.
 */
var readChunk = function( oChunk, fpCallback )
{
    /**
     * FileReaderSync or FileReader object used for file read.
     *
     * The object depends on the support, FileReaderSync is preferred.
     *
     * @requires FileReaderSync|FileReader
     */
    var oFileReader = null;

    if ( "undefined" !== typeof FileReaderSync )
    {
        oFileReader = new FileReaderSync();

        readChunk = function( oChunk, fpCallback )
        {
            fpCallback( oFileReader.readAsBinaryString( oChunk ) );
        }
    }
    else if ( "undefined" !== typeof FileReader )
    {
        oFileReader = new FileReader();

        readChunk = function( oChunk, fpCallback )
        {
            oFileReader.onload = function( oEvent )
            {
                 fpCallback( oEvent.target.result );
            }
            oFileReader.readAsBinaryString( oChunk );
        }
    }
    else
    {
        throw new Error( 'File API is not supported in this browser.' );
    }

    return readChunk ( oChunk, fpCallback );
}
