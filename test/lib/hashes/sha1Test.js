/**
 * Testing Sha1 object.
 */
TestCase( "Sha1TestCase", {
    setUp: function()
    {
        this.oSha1 = new Sha1();
    },
    testBasic: function()
    {
        var sHash = this.oSha1.feed( 'abcdef' ).finalize();

        assertSame( 'Test string should be hashed to the known hash.', '1f8ac10f23c5b5bc1167bda84b833e5c057a77d2', sHash );
    },
    testFeed: function()
    {
        var sHash, sControlHash;
        var oControlSha1 = new Sha1();

        sControlHash = oControlSha1.feed( '123456789' ).finalize();

        this.oSha1.feed( '123' );
        this.oSha1.feed( '456' );
        this.oSha1.feed( '789' );

        sHash = this.oSha1.finalize();

        assertSame( 'Multiple times updated hash should be the same as one time updated.',
            sControlHash, sHash );
    },
    testBinaryOutput: function()
    {
        var aExpected = [ 0x1f, 0x8a, 0xc1, 0x0f, 0x23, 0xc5, 0xb5, 0xbc, 0x11, 0x67, 0xbd, 0xa8, 0x4b, 0x83, 0x3e, 0x5c, 0x05, 0x7a, 0x77, 0xd2 ];
        var aResult = [];

        var sHash = this.oSha1.feed( 'abcdef' ).finalize( true );

        for ( var i = 0; i < 20; i++ )
        {
            aResult.push( sHash.charCodeAt( i ) );
        }

        assertEquals( 'Test string should be hashed to the known binary hash.',
            aExpected, aResult );
    },
    testLongInput: function()
    {
        var sInput = [];
        var sHash;

        for ( var i = 0; i < 1500; i++ )
        {
            // In JS string concatenating is slower than push.
            sInput.push( 'A' );
        }

        sHash = this.oSha1.feed( sInput.join( '' ) ).finalize();

        assertEquals( 'Test string should be hashed to the known binary hash.',
            'a7f644d4a5b863037da8cadd2e69640ef3dc804e', sHash );
    }
});