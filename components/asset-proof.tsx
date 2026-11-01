'use client';
import { useState, type ComponentType } from 'react';
import { ArrowUpRight, Check, Mail, MoreHorizontal, ShoppingBag } from 'lucide-react';
import type { Project } from '@/lib/types';
import { getProjectImage } from '@/lib/samples';

export default function AssetProof({
  project,
  mode,
  Preview,
}: {
  project: Project;
  mode: 'shop' | 'instagram' | 'email';
  Preview: ComponentType<{ project: Project; index: number; small?: boolean }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const photo = getProjectImage(project);
  if (mode === 'shop')
    return (
      <div className="ws-proof ws-proof-shop">
        <div className="ws-proof-chrome">
          <ShoppingBag size={14} />
          <span>Your shop window</span>
          <span>Content preview</span>
        </div>
        <div className="ws-proof-product">
          <div className="ws-proof-photo">
            {photo ? (
              <img src={photo} alt={`${project.product.name} product preview`} />
            ) : (
              <span>{project.product.brand.slice(0, 2)}</span>
            )}
          </div>
          <div>
            <small>{project.product.brand}</small>
            <h3>{project.kit.title}</h3>
            {project.product.price && (
              <strong className="ws-proof-price">
                {project.product.currency} {project.product.price}
              </strong>
            )}
            <p>
              {project.kit.description.slice(0, expanded ? undefined : 260)}
              {!expanded && project.kit.description.length > 260 ? '…' : ''}
            </p>
            {project.kit.description.length > 260 && (
              <button className="ws-inline-action" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : 'Read full description'}
              </button>
            )}
            <ul>
              {project.kit.bullets.slice(0, 3).map((fact, index) => (
                <li key={index}>
                  <Check size={12} />
                  {fact}
                </li>
              ))}
            </ul>
            {project.product.url && (
              <a
                className="ws-inline-action"
                href={project.product.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit product <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </div>
        <div className="ws-proof-note">
          A preview of your content. This does not publish or create a storefront.
        </div>
      </div>
    );
  if (mode === 'email')
    return (
      <div className="ws-proof ws-proof-mail">
        <div className="ws-proof-chrome">
          <Mail size={14} />
          <span>Your launch email</span>
          <span>Content preview</span>
        </div>
        <div className="ws-email-meta">
          <span>From</span>
          <strong>{project.product.brand}</strong>
          <span>Subject</span>
          <strong>{project.kit.emailSubject}</strong>
        </div>
        <div className="ws-email-body">
          {project.kit.emailBody.split('\n').map((line, index) => (
            <p key={index}>{line || '\u00a0'}</p>
          ))}
        </div>
        <div className="ws-proof-note">Preview only. No email is sent from StudioShelf.</div>
      </div>
    );
  return (
    <div className="ws-proof ws-proof-social">
      <div className="ws-proof-chrome">
        <span className="ws-proof-avatar">{project.product.brand.slice(0, 1)}</span>
        <strong>{project.product.brand}</strong>
        <MoreHorizontal size={17} />
      </div>
      <Preview project={project} index={0} />
      <div className="ws-caption-body">
        <strong>{project.product.brand}</strong>
        <p>
          {project.kit.instagram.slice(0, expanded ? undefined : 180)}
          {!expanded && project.kit.instagram.length > 180 ? '…' : ''}
        </p>
        {project.kit.instagram.length > 180 && (
          <button className="ws-inline-action" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Read full caption'}
          </button>
        )}
      </div>
      <div className="ws-proof-note">Social post preview. Nothing has been published.</div>
    </div>
  );
}
