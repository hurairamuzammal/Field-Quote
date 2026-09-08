'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import WorkflowVisual from './WorkflowVisual';
import { WORKFLOW_STEPS } from './workflow-data';

export default function Sequence() {
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = Boolean(useReducedMotion());
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const visualRef = useRef<HTMLDivElement>(null);

  /**
   * The card panel is sticky, so the step it illustrates is whichever step text
   * sits closest to the panel's own centre — not to the viewport centre, and not
   * to an even slice of the section's scroll range (the intro block and section
   * padding live inside that range too).
   */
  const syncActiveStep = useCallback(() => {
    const visual = visualRef.current;
    const visualRect = visual?.getBoundingClientRect();
    const anchorY =
      visualRect && visualRect.height > 0
        ? visualRect.top + visualRect.height / 2
        : window.innerHeight / 2;

    let nextStep = 0;
    let closest = Number.POSITIVE_INFINITY;

    stepRefs.current.forEach((step, index) => {
      if (!step) return;
      const rect = step.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - anchorY);
      if (distance < closest) {
        closest = distance;
        nextStep = index;
      }
    });

    setActiveStep((current) => (current === nextStep ? current : nextStep));
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncActiveStep();
      });
    };

    syncActiveStep();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [syncActiveStep]);

  return (
    <section
      id="how-it-works"
      className="workflow section-pad-lg"
      aria-labelledby="workflow-heading"
    >
      <div className="container">
        <div className="workflow-intro">
          <div>
            <p className="section-label">How it works</p>
            <h2 id="workflow-heading" className="section-heading">
              One request. One continuous journey.
            </h2>
          </div>
          <p className="section-intro">
            Every digital step moves the job toward a confirmed visit and documented
            finish. Follow the request from first detail to completed electrical work.
          </p>
        </div>

        <div className="workflow-grid">
          <ol className="workflow-steps">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                className="workflow-step"
                data-active={activeStep === index}
                key={step.number}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
              >
                <div>
                  <span className="workflow-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <span className="workflow-step-note">{step.note}</span>
                  <span className="workflow-mobile-status">{step.status}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="workflow-visual-wrap" ref={visualRef}>
            <WorkflowVisual
              activeStep={activeStep}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
