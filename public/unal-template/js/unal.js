// Buscador decorativo: la carga del widget de Google Custom Search
// se quitó a propósito en scripts/scope-unal-template-css.mjs.
jQuery(document).ready(function($) {
    prepare_content_menu();
    $("#unalOpenMenuServicios, #unalOpenMenuPerfiles").on("click", function(e) {
        var $target = $(this).data("target");
        var $mOffset = $(this).offset();
        $($target).css({
            top: $mOffset.top + $(this).outerHeight(),
            left: $mOffset.left
        });
    });

    function serviceMenuStatus() {
        var $s = $("#services");
        $s.height($(window).height());
        $("ul", $s).height($(window).height());
        if ($(".indicator", "#services").hasClass("active")) {
            $s.css({
                right: 0
            });
        } else {
            $s.css({
                right: parseInt($("#services").width()) * -1
            });
        }
    }
    $(".indicator", "#services").click(function() {
        $(this).toggleClass("active");
        serviceMenuStatus();
    });
    $(window).resize(function() {
        $(".open").removeClass("open");
        if ($(window).width() > 767) {
            $("#services").css({
                right: parseInt($("#services").width()) * -1,
                left: "auto",
                top: "auto"
            });
            $("#bs-navbar").removeClass("in");
            serviceMenuStatus();
        } else {
            $(".indicator", "#services").removeClass("active");
        }
    });
    $("#services").css({
        right: parseInt($("#services").width()) * -1
    });
    serviceMenuStatus();
});

function prepare_content_menu(){
    var $content_subdominio = $( "#subdominio" ).html();
    $( "#container_subdominio_mobil" ).html( $content_subdominio );

    var $content_buscador = $( "#buscador" ).html();
    $( "#container_buscador_mobil" ).html( $content_buscador );

    var $content_mainmenu = $('#main_menu_container').clone().find(".menu_sedes").remove().end().html()
    $( "#container_mainmenu_mobil" ).html( $content_mainmenu );

    var $conten_sedes = $( "#sedes" ).html();
    $( "#container_sedes_mobil" ).html( $conten_sedes );

    var $conten_servicios = $( "#servicios" ).html();
    $( "#container_servicios_mobil" ).html( "<ul>" + $conten_servicios + "</ul>");

    var $conten_profiles = $( "#profiles" ).html();
    $( "#container_profiles_mobil" ).html( $conten_profiles );
}
