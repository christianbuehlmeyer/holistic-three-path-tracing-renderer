const glsl = require('glslify');
export default glsl(`
  precision highp float;
  precision highp int;

  void main()
  {
    gl_Position = vec4( position, 1.0 );
  }
`);