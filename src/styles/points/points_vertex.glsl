uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_map_position;
uniform vec3 u_tile_origin;
uniform float u_meters_per_pixel;

uniform mat4 u_model;
uniform mat4 u_modelView;

attribute vec4 a_position;
attribute vec4 a_shape;
attribute vec4 a_color;
attribute vec2 a_texcoord;
attribute vec2 a_offset;

varying vec4 v_color;
varying vec2 v_texcoord;
varying vec4 v_world_position;

#pragma tangram: camera
#pragma tangram: global

vec2 rotate2D(vec2 _st, float _angle) {
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
}

void main() {
    // Adds vertex shader support for feature selection
    #pragma tangram: feature-selection-vertex

    v_color = a_color;
    v_texcoord = a_texcoord;

    // Position
    vec4 position = u_modelView * vec4(a_position.xyz * 32767., 1.);

    // Apply positioning and scaling in screen space
    float zscale = fract(u_map_position.z) * (a_shape.w * 256. - 1.) + 1.;
    // float zscale = log(fract(u_map_position.z) + 1.) / log(2.) * (a_shape.w - 1.) + 1.;
    vec2 shape = a_shape.xy * 256. * zscale;     //
    vec2 offset = vec2(a_offset.x, -a_offset.y); // flip y to make it point down
    float theta = radians(a_shape.z * 360.);

    shape = rotate2D(shape, theta);             // apply rotation to vertex
    shape += rotate2D(offset * 32767., theta);  // apply offset on rotated axis (e.g. so line labels follow text axis)

    // World coordinates for 3d procedural textures
    v_world_position = u_model * position;
    v_world_position.xy += shape * u_meters_per_pixel;
    #if defined(TANGRAM_WORLD_POSITION_WRAP)
        v_world_position.xy -= world_position_anchor;
    #endif

    // Modify position before camera projection
    #pragma tangram: position

    cameraProjection(position);

    #ifdef TANGRAM_LAYER_ORDER
        applyLayerOrder(a_position.w * 32767., position);
    #endif

    position.xy += shape * 2. * position.w / u_resolution;

    gl_Position = position;
}
