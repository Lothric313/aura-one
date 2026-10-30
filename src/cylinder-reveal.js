import { clamp, scrollProgressAtScene } from './timeline.js';
import { easeMotion } from './motion.js';

export const ERA_RANGE = Object.freeze({ start: .715, end: .805 });
const eraStart = scrollProgressAtScene(ERA_RANGE.start);
const eraDuration = scrollProgressAtScene(ERA_RANGE.end) - eraStart;

export function cylinderLinePose(progress, index, count, width, height, reduced = false) {
  const travel = easeMotion(clamp((scrollProgressAtScene(progress) - eraStart) / eraDuration));
  // One common scroll beat and the same smooth easing as the other transitions.
  const phase = travel * 360 - 180;
  const angle = (count - 1) * 18 - index * 36 + phase;
  const radius = Math.min(width * .25, height * .32, 280);
  if (reduced) {
    const gap = Math.min(width * .1, height * .13, 120);
    const y = (1 - travel * 2) * (height + count * gap) + (index - (count - 1) / 2) * gap;
    return { angle: 0, radius: 0, y };
  }
  return { angle, radius, y: -Math.sin(angle * Math.PI / 180) * radius };
}

/** Four solid text lines revolve around a horizontal cylinder, without opacity fades. */
export function createCylinderReveal(container, { reducedMotion }) {
  const cylinder = container.querySelector('.era-cylinder');
  const lines = ['НОВАЯ', 'ЭРА', 'ВИРТУАЛЬНОЙ', 'РЕАЛЬНОСТИ'].map(text => {
    const line = document.createElement('span'); line.textContent = text;
    cylinder.appendChild(line); return line;
  });
  let lastProgress=-1, lastReduced=null, width=innerWidth, height=innerHeight, wasActive=false;
  function resize() { width=innerWidth; height=innerHeight; lastProgress=-1; }
  return {
    resize,
    async prepare() {
      await document.fonts.load('900 112px Inter', lines.map(line=>line.textContent).join(' '));
      // Give the compositor a frame to rasterize every line before its first rotation.
      container.style.visibility='visible'; container.style.opacity='.001';
      lines.forEach((line,i)=>{line.style.transform=`translate(-50%,-50%) translate3d(0,${(i-1.5)*100}px,0)`;});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      container.style.visibility='hidden'; container.style.opacity='1'; lastProgress=-1;
    },
    update(progress) {
      const active = progress >= ERA_RANGE.start && progress <= ERA_RANGE.end;
      if(active!==wasActive){container.style.visibility = active ? 'visible' : 'hidden';wasActive=active;}
      if (!active) return;
      if(progress===lastProgress&&reducedMotion.matches===lastReduced)return;
      lastProgress=progress;lastReduced=reducedMotion.matches;
      lines.forEach((line, index) => {
        const { angle, radius, y } = cylinderLinePose(progress, index, lines.length, width, height, reducedMotion.matches);
        line.style.transform = reducedMotion.matches
          ? `translate(-50%,-50%) translateY(${y}px)`
          : `translate(-50%,-50%) rotateX(${angle}deg) translateZ(${radius}px)`;
      });
    },
  };
}
