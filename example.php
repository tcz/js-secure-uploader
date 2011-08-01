<?php

/**
 * Good old procedural cowboy-coded example of using js-secure-uploader.
 *
 * I felt constant pain in my cerebral cortex while I was writing it.
 *
 * DON'T USE THIS FILE IN PRODUCTION, IT ONLY SERVES AS DEMONSTRATION.
 */

// We communicate with the script using status codes, so we need to send 500 if
// something is wrong.
set_error_handler( 'send_500', E_USER_ERROR );

// Hash verification for big files might take looooong.
set_time_limit( 0 );

$target_dir = dirname( __FILE__ ) . '/chunks/' . $_POST['guid'];
$target_name = basename( $_FILES['chunk']['name'] ) . "." . sprintf( '%015s', $_POST['offset'] );
$target_path = $target_dir . "/" . $target_name;

// Creating directory to store chunks belonging to the same file.
if ( !is_dir( $target_dir ) && !@mkdir( $target_dir, 0755, true ) )
{
     trigger_error( "Unable to create target directory $target_dir\n" . var_export( error_get_last(), true ), E_USER_ERROR );
}

// Moving current chunk to the directory.
if ( !@move_uploaded_file( $_FILES['chunk']['tmp_name'], $target_path ) )
{
    trigger_error( "Unable to move uploaded file to $target_path\n" . var_export( error_get_last(), true ), E_USER_ERROR );
}

// Comparing calculated chunk hash with expected.
if ( strtolower( sha1_hash_file( $target_path ) ) !== strtolower( $_POST['hash'] ) )
{
    trigger_error( "Hash mismatch for chunk.", E_USER_ERROR );
}

if ( !isset( $_POST['entire_hash'] ) )
{
    die();
}

$final_name = basename( $_FILES['chunk']['name'] );
// Last chunk, we can combine the file.
$final_path = combine_chunks( $final_name, $target_dir );

// Comparing calculated file hash with expected.
if ( strtolower( sha1_hash_file( $final_path ) ) !== strtolower( $_POST['entire_hash'] ) )
{
    trigger_error( "Hash mismatch for file.", E_USER_ERROR );
}

// Removing chunks.
clear_directory( $final_name, $target_dir );

die();

/**
 * Calculates SHA1 hash of a file.
 *
 * @param string $path Path of the input file.
 * @return string Hexadecimal annotation fo the calculated hash.
 */
function sha1_hash_file( $path )
{
    $file_handle = @fopen( $path, 'rb' );
    if ( !$file_handle )
    {
        trigger_error( "Unable to open file $path\n" . var_export( error_get_last(), true ), E_USER_ERROR );
    }
    $hash_handle = hash_init( 'sha1' );

    // Rewinding file.
    fseek( $file_handle, 0 );
    hash_update_stream( $hash_handle, $file_handle );

    fclose( $file_handle );

    return hash_final( $hash_handle, false );
}

/**
 * Combines uploaded chunks in a directory into an entire file.
 *
 * @param string $to_name Basename of the result file.
 * @param string $directory_path Path of the directory containing chunks.
 * @return string Qualified pathname of the result file.
 */
function combine_chunks( $to_name, $directory_path )
{
    $chunk_list = array();

    foreach ( new DirectoryIterator( $directory_path ) as $file )
    {
        if ( $file->isDot() ) continue;
        if ( $file->isDir() ) continue;
        // Target file is ignored.
        if ( $to_name == $file->getFilename() ) continue;

        $chunk_list[] = $file->getFilename();
    }

    if ( 1 == count( $chunk_list ) )
    {
        // If there is only one chunk, we simply rename it.
        $chunk_path = rtrim( $directory_path, '/' ) . '/' . $chunk_list[0];
        $file_path = rtrim( $directory_path, '/' ) . '/' . $to_name;

        rename( $chunk_path, $file_path );
        return $file_path;
    }

    // Alphabetical order is important.
    sort( $chunk_list );

    $file_path = rtrim( $directory_path, '/' ) . '/' . $to_name;
    $file_handle = @fopen( $file_path, 'ab' );
    if ( !$file_handle )
    {
        trigger_error( "Unable to open file $file_path" . var_export( error_get_last(), true ), E_USER_ERROR );
    }

    foreach ( $chunk_list as $chunk )
    {
        $chunk_path = rtrim( $directory_path, '/' ) . '/' . $chunk;
        $chunk_handle = @fopen( $chunk_path, 'rb' );
        if ( !$chunk_handle )
        {
            trigger_error( "Unable to open file $chunk_path" . var_export( error_get_last(), true ), E_USER_ERROR );
        }
        stream_copy_to_stream( $chunk_handle, $file_handle );

        fclose( $chunk_handle );
    }

    fclose( $file_handle );

    return $file_path;
}

/**
 * Removes all files from a directory with one exception.
 *
 * @param string $exception Basename of the file to keep.
 * @param string $directory_path Directory path to clean.
 */
function clear_directory( $exception, $directory_path )
{
    foreach ( new DirectoryIterator( $directory_path ) as $file )
    {
        if ( $file->isDot() ) continue;
        if ( $file->isDir() ) continue;
        if ( $exception == $file->getFilename() ) continue;

        unlink( $file->getPathname() );
    }
}

/**
 * Custom error handler to send 500 HTTP header in case of user error.
 *
 * This lets the script know that something is wrong.
 * Errors are passed back to PHP in the end.
 *
 * @param integer $errno
 * @param string $errstr
 * @param string $errfile
 * @param integer $errline
 * @return type
 */
function send_500( $errno, $errstr, $errfile, $errline )
{
    // Letting the script know that something is wrong.
    header( 'HTTP/1.0 500 Internal Server Error' );
    // Let PHP do its job.
    return false;
}