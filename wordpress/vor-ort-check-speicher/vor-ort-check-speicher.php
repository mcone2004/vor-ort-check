<?php
/**
 * Plugin Name: Vor-Ort-Check Speicher
 * Description: Eigener, nicht öffentlicher Inhaltstyp für die Daten der App Vor-Ort-Check (später auch Cockpit). Hält die Beitragsliste sauber.
 * Version: 1.0.0
 * Author: Energieberatung Lange UG
 */
if (!defined('ABSPATH')) { exit; }

add_action('init', function () {
    register_post_type('ocheck', array(
        'labels' => array(
            'name'          => 'Vor-Ort-Check',
            'singular_name' => 'Vor-Ort-Check Datensatz',
            'all_items'     => 'Alle Datensätze',
            'menu_name'     => 'Vor-Ort-Check',
        ),
        'public'              => false,
        'publicly_queryable'  => false,
        'exclude_from_search' => true,
        'show_ui'             => true,
        'show_in_menu'        => true,
        'show_in_nav_menus'   => false,
        'show_in_admin_bar'   => false,
        'has_archive'         => false,
        'rewrite'             => false,
        'query_var'           => false,
        'show_in_rest'        => true,
        'rest_base'           => 'ocheck',
        'supports'            => array('title', 'editor', 'author'),
        'capability_type'     => 'post',
        'map_meta_cap'        => true,
        'menu_icon'           => 'dashicons-clipboard',
        'menu_position'       => 80,
    ));
});
