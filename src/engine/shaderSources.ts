import axisGizmoWGSL from '../shaders/axis_gizmo.wgsl?raw';
import basicWGSL from '../shaders/basic.wgsl?raw';
import depthWGSL from '../shaders/depth.wgsl?raw';
import gridSolidWGSL from '../shaders/grid_solid.wgsl?raw';
import lightBeamWGSL from '../shaders/light_beam.wgsl?raw';
import objectCommonWGSL from '../shaders/modules/object_common.wgsl?raw';
import poisson64WGSL from '../shaders/modules/poisson64.wgsl?raw';
import pcfWGSL from '../shaders/pcf.wgsl?raw';
import pcssWGSL from '../shaders/pcss.wgsl?raw';
import vsmWGSL from '../shaders/vsm.wgsl?raw';
import vsmBlurWGSL from '../shaders/vsm_blur.wgsl?raw';
import vsmMomentsWGSL from '../shaders/vsm_moments.wgsl?raw';

const modules: Record<string, string> = {
  object_common: objectCommonWGSL,
  poisson64: poisson64WGSL
};

const resolveIncludes = (source: string): string =>
  source.replace(/^\/\/\s*@include\s+([a-zA-Z0-9_-]+)\s*$/gm, (_match, name: string) => {
    const module = modules[name];
    if (!module) {
      throw new Error(`Unknown WGSL include: ${name}`);
    }
    return module;
  });

export const shaders = {
  axisGizmo: axisGizmoWGSL,
  basic: resolveIncludes(basicWGSL),
  depth: depthWGSL,
  gridSolid: gridSolidWGSL,
  lightBeam: lightBeamWGSL,
  pcf: resolveIncludes(pcfWGSL),
  pcss: resolveIncludes(pcssWGSL),
  vsm: resolveIncludes(vsmWGSL),
  vsmBlur: vsmBlurWGSL,
  vsmMoments: vsmMomentsWGSL
};
