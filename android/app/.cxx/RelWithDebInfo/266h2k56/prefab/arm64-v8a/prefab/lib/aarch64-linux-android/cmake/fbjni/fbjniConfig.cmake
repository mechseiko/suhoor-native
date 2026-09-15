if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "C:/Users/abdul/.gradle/caches/transforms-4/323d5739058a7e6caa1c683b93c1bf83/transformed/fbjni-0.6.0/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/abdul/.gradle/caches/transforms-4/323d5739058a7e6caa1c683b93c1bf83/transformed/fbjni-0.6.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

