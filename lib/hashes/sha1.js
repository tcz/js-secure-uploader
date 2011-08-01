/**
 * @fileOverview Instantiatable object to calculate SHA-1 hash from chunks (updateable).
 * @author Zoltan Toth-Czifra
 * @license New (3 clause) BSD license - see LICENSE file.
 *
 * Copyright (C) Zoltan Toth-Czifra
 *
 * Based on RFC 3174 - US Secure Hash Algorithm 1 (SHA1)
 * http://www.faqs.org/rfcs/rfc3174.html
 */

/**
 * Creates an instance of Sha1.
 *
 * @constructor
 */
var Sha1 = function()
{
    /**
     * Contains the current state of the hash computation result.
     *
     * Initializing - RFC 6.1.
     *
     * @type {object}
     */
    this.aResults = {
        h0: 0x67452301,
        h1: 0xEFCDAB89,
        h2: 0x98BADCFE,
        h3: 0x10325476,
        h4: 0xC3D2E1F0
    };

    /**
     * Contains the last block of the last fed inpput.
     *
     * This is skipped from the hash computaion and constantly merged
     * with the new-coming messages. Finally used when the hash in finalized.
     * This is because we need to append information here once the entire
     * input ends.
     *
     * @type {array}
     */
    this.aLastBlock = null;

    /**
     * Contains total message length of all fed inputs. Increments contatnly.
     *
     * @type {number}
     */
    this.nAccumulatedMessageLength = 0;
};
/**
 * "Feeds" the hash with new string input.
 *
 * @param {string} sInput String chunk to update the hash with.
 * @param {boolean} bUnicode UTF8 input to first converted to binary, it should be true.
 * @return {object} Return "this" to create fluent interface.
 */
Sha1.prototype.feed = function( sInput, bUnicode )
{
    var aWords, sFeed;

    if ( !sInput )
    {
        return this;
    }

    if ( bUnicode )
    {
        sInput = this.utf8Encode( sInput );
    }

    sFeed = sInput;

    // If there is a last block alread saved, we extract it to string and
    // add it to the beginning of the current feed.
    if ( this.aLastBlock )
    {
        // The 2nd parameter is the length of tha payload.
        // This is the number of actually used bytes in the block.
        //
        // If "Overall message length MOD 64" == 0, means we have a full
        // block, so the payload length is 64 ( 0 || 64 ).
        sFeed = this.extractBlock( this.aLastBlock, ( this.nAccumulatedMessageLength % 64 ) || 64 ) + sFeed;
    }

    aWords = this.chunk( sFeed );

    // We save the last block and skip it from the current process, because
    // at the end of hash generation (finalize) we will need to append
    // extra information to this.
    this.aLastBlock                    = aWords.pop();
    this.nAccumulatedMessageLength  += sInput.length;

    this.feedHashWithBlocks( aWords );

    // Fluent interface.
    return this;
};
/**
 * Finalizes the hash computation and returns the final hash.
 *
 * Onc hash computation is finalised,you cannot feed more input.
 *
 * @param {boolean} bRaw Tells is we want the hash to be binary or in hexadeciamal notation.
 *                  Optional, default is false.
 * @return {string} Hexadecimal annotated or binary representation of the final hash.
 */
Sha1.prototype.finalize = function( bRaw )
{
    bRaw = bRaw || false;

    if ( this.aLastBlock )
    {
        this.feedHashWithBlocks( this.padLastBlock( this.aLastBlock ) );
        this.aLastBlock = null;
    }

    this.feed = function()
    {
        /** @todo Being able to feed after finalizing. */
        throw new Error( 'You cannot feed an already finalized hash again.' );
    }

    if ( bRaw )
    {
        return this.formatHashBinary();
    }
    return this.formatHashHex();
};
/**
 * Formats hash computation results in hexadecimal annotation.
 *
 * @protected
 * @return {string} 40-bytes hexadecimal represeantion of the final hash.
 */
Sha1.prototype.formatHashHex = function()
{
    return  this.binaryToHexString( this.aResults.h0 ) +
            this.binaryToHexString( this.aResults.h1 ) +
            this.binaryToHexString( this.aResults.h2 ) +
            this.binaryToHexString( this.aResults.h3 ) +
            this.binaryToHexString( this.aResults.h4 );
};
/**
 * Formats hash computation results in a binary string.
 *
 * @protected
 * @return {string} 20-bytes binary represeantion of the final hash.
 */
Sha1.prototype.formatHashBinary = function()
{
    var sHash = '';
    var aParts = [
        this.aResults.h0,
        this.aResults.h1,
        this.aResults.h2,
        this.aResults.h3,
        this.aResults.h4
    ];

    // Iterating over all parts of the hash.
    for ( var i = 0; i < 5; i++ )
    {
        // Chopping the words into bytes.
        for ( var j = 0; j < 4; j++ )
        {
            sHash += String.fromCharCode( ( aParts[i] >>> ( 24 - j * 8 ) ) & 0xff );
        }
    }

    return sHash;
};
/**
 * Converts UTF-8 Javascript strings to binary.
 *
 * @author: Chris Veness
 * @license Attribution 3.0 Unported (CC BY 3.0
 * @param {string} sInput String to convertot binary.
 * @return {string} Converted string.
 */
Sha1.prototype.utf8Encode = function( sInput )
{
    // Regural expressions in this case are proved to be quick.
    sInput = sInput.replace(
        /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
        function( sUnicodeChar )
        {
            var nCharcode = sUnicodeChar.charCodeAt( 0 );
            return String.fromCharCode( 0xc0 | nCharcode>>6, 0x80 | nCharcode&0x3f );
        }
    );
    sInput = sInput.replace(
        /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
        function( sUnicodeChar ) {
            var nCharcode = sUnicodeChar.charCodeAt( 0 );
            return String.fromCharCode( 0xe0 | nCharcode >> 12, 0x80 | nCharcode >> 6&0x3F, 0x80 | nCharcode & 0x3f );
        }
    );
    return sInput;
};
/**
 * Chunks the input string into blocks and words inside the block. RFC - 6.1.
 *
 * The last block is padded with 0s, just like the last used word.
 *
 * @protected
 * @param {string} sInput The input string to chunk.
 * @return {array} Array containing arrays (blocks) of 16 pieces of 32 bits words each.
 */
Sha1.prototype.chunk = function( sInput )
{
    var nWords  = sInput.length / 4;
    var nBlocks = Math.ceil( nWords / 16 );
    var aResult = new Array( nBlocks );

    for ( var i=0; i < nBlocks; i++ )
    {
        aResult[i] = new Array(16);
        for ( var j = 0; j < 16; j++ )
        {
            // Non-existing sting offsets will be converted to 0.
            aResult[i][j] = ( +sInput.charCodeAt( ( i * 64 ) + ( j * 4 ) )        << 24 ) |
                            ( +sInput.charCodeAt( ( i * 64 ) + ( j * 4 ) + 1 )    << 16 ) |
                            ( +sInput.charCodeAt( ( i * 64 ) + ( j * 4 ) + 2 )    << 8 )  |
                            ( +sInput.charCodeAt( ( i * 64 ) + ( j * 4 ) + 3 ) );
        }
    }

    return aResult;
};
/**
 * Updates the current value of the hash with the 512b blocks (16pcs of 32b words) from the parameter.
 *
 * RFC 6.1.
 *
 * @protected
 * @praram {array} Array of arrays. Each item is a 16 items array containing 32b words.
 */
Sha1.prototype.feedHashWithBlocks = function( aWords )
{
    var nBlocks = aWords.length;

    for ( var i = 0; i < nBlocks; i++ )
    {
        // Initializing hash values for this chunk.
        var nChunkA = this.aResults.h0;
        var nChunkB = this.aResults.h1;
        var nChunkC = this.aResults.h2;
        var nChunkD = this.aResults.h3;
        var nChunkE = this.aResults.h4;

        // Exending words in the block to 80 words using formula.
        for ( var j = 16; j < 80; j++ )
        {
            aWords[i][j] = ( aWords[i][j - 3] ^ aWords[i][j-8] ^ aWords[i][j - 14] ^ aWords[i][j - 16] );
            aWords[i][j] = this.leftRotate( aWords[i][j], 1 );
        }

        for ( j = 0; j < 80; j++ )
        {
            var nTemp, nCurrentConstant;
            var nFunctionIndex = Math.floor( j / 20 );

            nTemp               = Sha1.logicalFunctions[nFunctionIndex]( nChunkB, nChunkC, nChunkD );
            nCurrentConstant    = Sha1.constants[nFunctionIndex];

            nTemp = this.leftRotate( nChunkA, 5 ) + nTemp + nChunkE + nCurrentConstant + aWords[i][j];
            // Trimming bit overflow.
            nTemp = nTemp & 0xffffffff;

            nChunkE = nChunkD;
            nChunkD = nChunkC;
            nChunkC = this.leftRotate( nChunkB, 30 );
            nChunkB = nChunkA;
            nChunkA = nTemp;
        }

        // Adding values to the current results while trimming bit overflow.
        this.aResults.h0 = ( this.aResults.h0 + nChunkA ) & 0xffffffff;
        this.aResults.h1 = ( this.aResults.h1 + nChunkB ) & 0xffffffff;
        this.aResults.h2 = ( this.aResults.h2 + nChunkC ) & 0xffffffff;
        this.aResults.h3 = ( this.aResults.h3 + nChunkD ) & 0xffffffff;
        this.aResults.h4 = ( this.aResults.h4 + nChunkE ) & 0xffffffff;
    }
};
/**
 * Message padding to be done on the entire input according to RFC 4.
 *
 * In order the hash calculation to be "feedable", this is done in the end
 * during finalizing.
 *
 * @param {array} aLastBlock The last block of the message omitted from calculation so far.
 * @return {array} Array of blocks (1 or 2) to feed the hash calculation function
 *                 finally, containing blocks that are padded according to RFC.
 */
Sha1.prototype.padLastBlock = function( aLastBlock )
{
    var aReturn = [];
    var nPaddingByteByte = this.nAccumulatedMessageLength % 4;
    var nPaddingByteWord = Math.floor( this.nAccumulatedMessageLength / 4 ) % 16;

    // We need to add one extra bit to the message. If this bit would result in
    // the message to be too long for the block, we would need to add another
    // block.
    if ( 0 == nPaddingByteWord && 0 == nPaddingByteByte )
    {
        aReturn.push( aLastBlock );
        aLastBlock = this.createEmptyBlock();
        nPaddingByteWord = 0;
        nPaddingByteByte = 0;
    }

    // Adding extra bit tot he message.
    aLastBlock[nPaddingByteWord] = aLastBlock[nPaddingByteWord] | ( 0x80 << ( 24 - nPaddingByteByte * 8 ) );

    // In the next step ne need to append 2 words (64 bits) to the block containing
    // the length of the final message (in bits).
    // If this would not fit into the block, we need to add a new block.
    if ( nPaddingByteWord > 13 )
    {
        aReturn.push( aLastBlock );
        aLastBlock = this.createEmptyBlock();
    }
    // Appending bit-length of original message.
    aLastBlock[14] =  Math.floor( this.nAccumulatedMessageLength / Math.pow( 2, 29 ) );
    aLastBlock[15] = ( ( this.nAccumulatedMessageLength ) * 8 ) & 0xffffffff;

    aReturn.push( aLastBlock );
    return aReturn;
};
/**
 * Takes a block created with chunking and restores its binary information.
 *
 * @protected
 * @param {array} aBlock The block to restore.
 * @param {number} nLengthPayload The length of used bytes inside the block
 *                                (will be the length of the retuned string).
 * @return {string} Restored input string.
 */
Sha1.prototype.extractBlock = function( aBlock, nLengthPayload )
{
    var sReturn = '';
    var nLastUsedWord = Math.floor( nLengthPayload / 4 ); // Zero-based.
    var nLastUsedByteInWord = nLengthPayload - nLastUsedWord * 4 - 1; // Zero-based.

    if ( 0 == nLengthPayload )
    {
        return sReturn;
    }

    // Iterating over all the words in the block.
    for ( var i = 0; i <= nLastUsedWord; i++ )
    {
        var nLastByte = 3; // Zero-based.
        if ( i == nLastUsedWord ) // We are in the last used word.
        {
            nLastByte = nLastUsedByteInWord;
        }

        // Chopping the words into bytes.
        for ( var j = 0; j <= nLastByte; j++ )
        {
            sReturn += String.fromCharCode( ( aBlock[i] >>> ( 24 - j * 8 ) ) & 0xff );
        }
    }

    return sReturn;
};
/**
 * Creates an empty input block consiting of 16 0-filled 32bits words.
 *
 * @protected
 * @return {array} 16 items filled with 0s.
 */
Sha1.prototype.createEmptyBlock = function()
{
    var aEmptyBlock = new Array(16);

    for ( var j = 0; j < 16; j++ )
    {
        // Setting 0-filled words to values.
        aEmptyBlock[j] = 0;
    }
    return aEmptyBlock;
};
/**
 * Circular left shift bitwise operation - RFC 3.c.
 *
 * @protected
 * @param {number} nInput The input integer to rotate.
 * @param {number} nOffset The bit offset to shift with.
 * @return {number} Number consisting of the rotated bits.
 */
Sha1.prototype.leftRotate = function( nInput, nOffset )
{
    return ( nInput << nOffset ) | ( nInput >>> ( 32 - nOffset ) );
};
/**
 * Converts 32bit integer to its hexadecimal represenation.
 *
 * @protected
 * @param {number} nInput 32bit integer to be converted.
 * @return {string} Lowercase 8 bytes string representing the input in hexadecimal notation.
 */
Sha1.prototype.binaryToHexString = function( nInput )
{
    var sOutput = "";
    var nChunk;

    for ( var i = 7; i >= 0; i-- )
    {
        nChunk = ( nInput >>> ( i * 4 ) ) & 0xf;
        sOutput += nChunk.toString( 16 );
    }

    return sOutput;
};
/**
 * Simple logical functions for bitwise operations - RFC 5.
 *
 * @final
 * @type array
 */
Sha1.logicalFunctions = [
    // Index 0.
    function( nChunkB, nChunkC, nChunkD )
    {
        return ( nChunkB & nChunkC ) | ( ( ~nChunkB ) & nChunkD );
    },
    // Index 1.
    function( nChunkB, nChunkC, nChunkD )
    {
        return nChunkB ^ nChunkC ^ nChunkD;
    },
    // Index 2.
    function( nChunkB, nChunkC, nChunkD )
    {
        return ( nChunkB & nChunkC ) | ( nChunkB & nChunkD ) | ( nChunkC & nChunkD );
    },
    // Index 3.
    function( nChunkB, nChunkC, nChunkD )
    {
        return nChunkB ^ nChunkC ^ nChunkD;
    }
];
/**
 * Constants used for bitwise operations - RFC 5.
 *
 * @final
 * @type array
 */
Sha1.constants = [
    0x5A827999,
    0x6ED9EBA1,
    0x8F1BBCDC,
    0xCA62C1D6
];
