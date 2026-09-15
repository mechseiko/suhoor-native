if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/abdul/.gradle/caches/transforms-4/97e043bdfff6a83d3014afcd8ee6aad2/transformed/hermes-android-0.74.5-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/abdul/.gradle/caches/transforms-4/97e043bdfff6a83d3014afcd8ee6aad2/transformed/hermes-android-0.74.5-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

