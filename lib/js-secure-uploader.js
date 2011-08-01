/**
 * @fileOverview Instantiatable object to handle file upload in chunks with hash generation.
 * @author Zoltan Toth-Czifra
 * @license New (3 clause) BSD license - see LICENSE file.
 *
 * Copyright (C) Zoltan Toth-Czifra
 */

/**
 * Creates an instance of SecureUploader.
 *
 * @constructor
 * @param {object} oFileInput File input DOM object.
 * @param {object} oSettings Object containing initial settings. See SecureUploaderSettings.
 */
var SecureUploader = function( oFileInput, oSettings )
{
    this.oFileInput         = oFileInput;
    this.oSettings          = new SecureUploaderSettings( oSettings );
    this.oUploader          = null;

    this.attachEvents();
};
/**
 * If start_on_change is off, you can trigger upload with this method.
 */
SecureUploader.prototype.start = function()
{
    if ( !this.oFileInput.files[0] )
    {
        return;
    }
    this.oUploader = new SecureUploaderFile( this.oFileInput.files[0], this.oSettings );
    this.oUploader.start();
};
/**
 * Returns a fraction number representing upload progress (0-1).
 *
 * @return {number} Fraction representing progress.
 */
SecureUploader.prototype.getProgressPercentage = function()
{
    if ( !this.oUploader )
    {
        return 0;
    }
    return this.oUploader.getProgressPercentage();
}
/**
 * Attached event to the input object if the start_on_change setting is true.
 *
 * @protected
 */
SecureUploader.prototype.attachEvents = function()
{
    var self = this;

    if ( this.oSettings.start_on_change )
    {
        this.oFileInput.onchange = function()
        {
            self.start.apply( self, [] );
        };
    }
};


/**
 * Creates an instance of SecureUploaderFile.
 *
 * @constructor
 * @param {object} oFile File object from file input.
 * @param {object} oSettings Object containing initial settings. See SecureUploaderSettings.
 */
var SecureUploaderFile = function( oFile, oSettings )
{
    this.oWorker        = null;
    this.oRequest       = null;

    this.oSettings      = oSettings;
    this.nOffset        = 0;
    this.nChunksize     = this.oSettings.chunk_size;
    this.oFile          = oFile;
    this.sGuid          = SecureUploaderFile.getGuid();
    this.nRetriesLeft   = 3;
};
/**
 * Starts hash generation and later upload of the file.
 */
SecureUploaderFile.prototype.start = function()
{
    this.createWorker();
    this.processNextChunk();
};
/**
 * Returns a fraction number representing upload progress (0-1).
 *
 * Considers already uplaoded chunks and the state of the current request.
 *
 * @return {number} Fraction representing progress.
 */
SecureUploaderFile.prototype.getProgressPercentage = function()
{
    var nProgress = 0;

    // Already uploaded chunks.
    nProgress += Math.max( this.nOffset - this.nChunksize, 0 ) / this.oFile.size;
    // Percentage of the current request.
    if ( this.oRequest )
    {
        nProgress += this.oRequest.getProgressPercentage() /
                    // The supposed chunk size of the current upload.
                    Math.min( this.nChunksize, ( this.oFile.size - Math.max( this.nOffset - this.nChunksize, 0 ) ) );
    }

    return nProgress;
}
/**
 * Creates a web worker to read file and generate hash to this.oWorker.
 *
 * If there is a worker already existing, it terminates it first
 *
 * @protected
 */
SecureUploaderFile.prototype.createWorker = function()
{
    // If there's a thread still running from another execution, we kill it.
    if ( this.oWorker )
    {
        this.oWorker.terminate();
    }

    this.oWorker = new Worker( this.oSettings.worker_path );

    var self = this;
    this.oWorker.onmessage = function( oEvent )
    {
        self.uploadChunk.apply( self, [ oEvent.data ] );
    };
};
/**
 * Sends the next chunk of the file to hash calculation.
 *
 * @protected
 * @return {boolen} False if there are no chunks left to process, true otherwise.
 */
SecureUploaderFile.prototype.processNextChunk = function()
{
    if ( this.nOffset >= this.oFile.size )
    {
        return false;
    }

    this.oWorker.postMessage( {
        "file"        : this.oFile,
        "offset"      : this.nOffset,
        "chunkSize"   : this.nChunksize,
        // If it's the last chunk, we tell the worker to return the overall hash too.
        "last"        : ( this.nOffset + this.nChunksize >= this.oFile.size )
    } );

    this.nOffset += this.nChunksize;
    return true;
};
/**
 * When the hash calculation returns, starts the upload of the file.
 *
 * @protected
 * @param {object} oResult Result of the hash calculation.
 *                         Contains keys "offset", "size", "binary", "hash".
 */
SecureUploaderFile.prototype.uploadChunk = function( oResult )
{
    var self = this;
    this.oRequest = new SecureUploaderRequest( this.oFile, this.sGuid, this.oSettings, oResult, function( bSuccess )
    {
        self.oRequest = null;
        if ( bSuccess )
        {
            // If upload is successful, we go on to the next chunk (if there is).
            if ( false === self.processNextChunk() )
            {
                // We finished uploading, the percentage always returns 100%.
                self.getProgressPercentage = function()
                {
                    return 1;
                }
            }
        }
        else if ( self.nRetriesLeft )
        {
            // If uplaod is unsuccessful, we try again (X times).
            self.nRetriesLeft--;
            self.uploadChunk( oResult );
        }
    } );
    this.oRequest.start();
};
/**
 * Generates a random GUID (yes, random GUID) for the current file to be uploaded.
 *
 * Can be used as reference to compile file chunks once the upload is complete.
 *
 * @final
 * @protected
 * @return 16 bytes long alphanumberic random string.
 */
SecureUploaderFile.getGuid = function()
{
    var sAllowedCharacters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZ";
    var sGuid = '';

    for ( var i = 0; i < 16; i++ )
    {
        var nOffset = Math.floor( Math.random() * sAllowedCharacters.length );
        sGuid += sAllowedCharacters.substring( nOffset, nOffset+1 );
    }

    return sGuid;
};


/**
 * Creates an instance of SecureUploaderRequest.
 *
 * @constructor
 * @param {object} oFile File object from file input.
 * @param {string} sGuid Unique identifier of the whole file upload to be used as reference.
 * @param {object} oSettings Object containing initial settings. See SecureUploaderSettings.
 * @param {object} oResult Result of the hash calculation for this chunk.
 * @param {callback} fpFinish Function to be called when the upload process finsihes.
 *                            Accepts one boolean parameter, true when successful.
 */
SecureUploaderRequest = function( oFile, sGuid, oSettings, oResult, fpFinish )
{
    this.oFile              = oFile;
    this.sGuid              = sGuid;
    this.oSettings          = oSettings;
    this.fpFinish           = fpFinish;

    this.sBinary            = oResult.binary;
    this.nOffset            = oResult.offset;
    this.nSize              = oResult.size;
    this.sHash              = oResult.hash;

    this.nEntireSize        = oResult.entire_size || null;
    this.sEntireHash        = oResult.entire_hash || null;

    this.nUploadProgress    = 0;
    this.oXhr               = null;
};
/**
 * Starts uploading process.
 */
SecureUploaderRequest.prototype.start = function()
{
    this.createXhr();

    this.oXhr.open( "POST", this.oSettings.url, true );
    this.oXhr.setRequestHeader( "Content-Type", "multipart/form-data; boundary=\"" + SecureUploaderRequest.MULTIPART_BOUNDARY + "\"" );
    this.oXhr.overrideMimeType( "text/plain; charset=x-user-defined-binary" );
    this.oXhr.sendAsBinary( this.getData() );
};
/**
 * Returns a fraction number representing upload progress of this chunk (0-1).
 *
 * @return {number} Fraction representing progress.
 */
SecureUploaderRequest.prototype.getProgressPercentage = function()
{
    return this.nUploadProgress;
}
/**
 * Returns payload of HTTP request containing all fields like hash, size, and
 * custom user-fields too, see request_params setting.
 *
 * @protected
 * @return {string} Payload for HTTP upload in multipart/form-data format.
 */
SecureUploaderRequest.prototype.getData = function()
{
    var aData = [];

    // File metadata.
    aData.push( this.createDataPart( 'guid',    this.sGuid ) );
    aData.push( this.createDataPart( 'offset',    this.nOffset ) );
    aData.push( this.createDataPart( 'size',    this.nSize ) );
    aData.push( this.createDataPart( 'hash',    this.sHash ) );

    // If it's the last piece, we send along the hash and size of the whole.
    if ( null !== this.nEntireSize && null !== this.nEntireHash )
    {
        aData.push( this.createDataPart( 'entire_size',    this.nEntireSize ) );
        aData.push( this.createDataPart( 'entire_hash',    this.sEntireHash ) );
    }

    // Additional parameters from the user.
    for ( var sParamKey in this.oSettings.request_params )
    {
        if ( this.oSettings.request_params.hasOwnProperty( sParamKey ) )
        {
            aData.push( this.createDataPart( sParamKey,    this.oSettings.request_params[sParamKey] ) );
        }
    }

    aData.push( this.createDataPart( 'chunk',    this.sBinary, {
        "filename": this.oFile.name
    }, this.oFile.type ) );

    aData.push( "--" );
    aData.push( SecureUploaderRequest.MULTIPART_BOUNDARY );
    aData.push( "--" );

    return aData.join( '' );
};
/**
 * Creates parts (fields) for multipart/form-data payload.
 *
 * @protected
 * @param {string} sName Name of the field.
 * @param {string} sData Value of the field.
 * @param {object} oAdditionalHeaders Key value pairs to be added to Content-Disposition header.
 * @param {string} sContentType Optional MIME type of the field.
 */
SecureUploaderRequest.prototype.createDataPart = function( sName, sData, oAdditionalHeaders, sContentType )
{
    var aPart = [];

    oAdditionalHeaders  = oAdditionalHeaders    || {};
    sContentType        = sContentType          || 'application/octet-stream';

    aPart.push( "--" );
    aPart.push( SecureUploaderRequest.MULTIPART_BOUNDARY );
    aPart.push( "\r\nContent-Disposition: form-data; " );
    aPart.push( "name=\"" );
    aPart.push( sName );
    aPart.push( "\"" );

    for ( var sHeaderKey in oAdditionalHeaders )
    {
        if ( oAdditionalHeaders.hasOwnProperty( sHeaderKey ) )
        {
            aPart.push( "; " );
            aPart.push( sHeaderKey );
            aPart.push( "=\"" );
            aPart.push( oAdditionalHeaders[sHeaderKey] );
            aPart.push( "\"" );
        }
    }

    aPart.push( "\r\nContent-Type: " );
    aPart.push( sContentType );

    aPart.push( "\r\n\r\n" );
    aPart.push( sData );
    aPart.push( "\r\n" );

    return aPart.join( '' );
};
/**
 * Creates and sets up an XMLHttpRequest object and puts it to this.oXhr.
 *
 * Also attaches events.
 *
 * @protected
 */
SecureUploaderRequest.prototype.createXhr = function()
{
    var self = this;

    this.oXhr = new XMLHttpRequest();

    this.oXhr.onreadystatechange = function()
    {
        if ( self.oXhr.readyState !== 4 )
        {
            return;
        }
        self.fpFinish( this.status == 200 );
    };

    this.oXhr.upload.onprogress = function( oEvent )
    {
        if ( oEvent.lengthComputable )
        {
            self.nUploadProgress = oEvent.loaded / oEvent.total;
        }
        else
        {
            self.nUploadProgress = 0;
        }
    }
};
/**
 * Constant to separate multipart elements of the request.
 *
 * @final
 * @type string
 */
SecureUploaderRequest.MULTIPART_BOUNDARY = "###SecureUploader###";


/**
 * Creates an instance of SecureUploaderSettings.
 *
 * Currently only sets defaults and returns plain object. With the settings.
 * Later might be used for more sophisticated jobs without changing the
 * references to it.
 *
 * @constructor
 * @param {object} oInitialSettings Object containing initial user settings.
 */
var SecureUploaderSettings = function( oInitialSettings )
{
    return {
        // Chunk size of the file. The file will be uploaded in max X bytes chunks.
        "chunk_size"      : oInitialSettings.chunk_size             || 102400,
        // Path of the worker code to be loaded. Relative to the HTML base.
        "worker_path"     : oInitialSettings.worker_path            || 'js-secure-uploader-worker.js',
        // Path where the file will be uploaded to (POST). Relative to the HTML base.
        "url"             : oInitialSettings.url                    || '/upload',
        // If true, upload will start right after file input changes.
        "start_on_change" : oInitialSettings.start_on_change        || false,
        // Additional parameters to be added to the upload request (POST fields).
        "request_params"  : oInitialSettings.request_params         || {}
    };
}

// Chrome does not support sending as binary by default.
if ( "undefined" == typeof XMLHttpRequest.prototype.sendAsBinary )
{
    /**
     * Sends Ajax request with binary payload.
     *
     * This is an implementation of the FF sendAsBinary method.
     *
     * @param {string} sData Request body to send.
     */
    XMLHttpRequest.prototype.sendAsBinary = function( sData )
    {
        var fpByteValue = function (x)
        {
            return x.charCodeAt(0) & 0xff;
        }
        var aOrds = Array.prototype.map.call( sData, fpByteValue );
        var oUi8a = new Uint8Array( aOrds );
        return this.send( oUi8a.buffer );
    }
}
