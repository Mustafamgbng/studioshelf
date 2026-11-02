'use client';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import JSZip from 'jszip';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  PackageCheck,
} from 'lucide-react';
import { download, safeName } from '@/lib/export';
import { launchChecks, productDestination, publishFiles, type PublishTarget } from '@/lib/publish';
import { getProjectImage } from '@/lib/samples';
import type { Project } from '@/lib/types';

export default function PublishPack({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (target: PublishTarget) => void;
}) {
  const [active, setActive] = useState('shop');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFile, setShowFile] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const files = useMemo(() => publishFiles(project), [project]);
  const channels = files.filter((file) => file.id !== 'subject');
  const selected = files.find((file) => file.id === active) || files[0];
  const checks = useMemo(() => launchChecks(project), [project]);
  const destination = productDestination(project.product.url);
  const photo = getProjectImage(project);
  const change = (id: string) => {
    setActive(id);
    setNotice('');
    setError('');
    setShowFile(false);
  };
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const index = channels.findIndex((file) => file.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % channels.length;
    else if (event.key === 'ArrowLeft') next = (index + channels.length - 1) % channels.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = channels.length - 1;
    else return;
    event.preventDefault();
    change(channels[next].id);
    tabs.current[next]?.focus();
  }
  async function copyFile(content = selected.content, label = selected.label) {
    setError('');
    try {
      await navigator.clipboard.writeText(content);
      setNotice(`${label} copied.`);
    } catch {
      setShowFile(true);
      setError(
        'Clipboard access is unavailable. Select the file content below and copy it manually.',
      );
    }
  }
  async function getPack() {
    setBusy(true);
    setError('');
    try {
      const zip = new JSZip();
      for (const file of files) zip.file(file.filename, file.content);
      zip.file(
        'READ-ME.txt',
        'StudioShelf channel handoff\n\nReview facts and links before use. HTML does not include an email provider’s unsubscribe footer. Add your sender details and required footer in your email tool. This pack does not publish or send anything. Download the complete launch kit for your artwork and editable backup.',
      );
      download(
        await zip.generateAsync({ type: 'blob' }),
        `${safeName(project.product.name)}-publish-pack.zip`,
      );
      setNotice('Your five channel files are downloaded.');
    } catch {
      setError('The pack could not be prepared. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pp-pack">
      <header className="pp-heading">
        <span>
          <PackageCheck size={23} />
        </span>
        <div>
          <span className="eyebrow">ONE PRODUCT → FOUR CHANNELS</span>
          <h3>Ready to leave the studio.</h3>
          <p>
            Your shop description, Instagram caption, WhatsApp message and launch email—prepared
            from the same kit.
          </p>
        </div>
      </header>
      <div className="pp-checks" aria-label="Launch checks">
        {checks.map((check) => (
          <button
            key={check.id}
            onClick={() => onNavigate(check.target)}
            className={check.ready ? 'is-ready' : ''}
          >
            <span>{check.ready ? <Check size={12} /> : <ArrowRight size={12} />}</span>
            <strong>{check.label}</strong>
            <small>{check.detail}</small>
            <i>
              {check.ready ? 'Review' : 'Fix this'} <ArrowRight size={11} />
            </i>
          </button>
        ))}
      </div>
      <div className="pp-file-heading">
        <div>
          <h4>Your channel handoff</h4>
          <p>Copy one file or download all five. Artwork is in your complete kit.</p>
        </div>
        <button className="btn btn-dark" disabled={busy} onClick={getPack}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} Download
          channel pack
        </button>
      </div>
      <div className="pp-tabs" role="tablist" aria-label="Publish channel" onKeyDown={navigate}>
        {channels.map((file, index) => (
          <button
            key={file.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            id={`publish-tab-${file.id}`}
            aria-controls="publish-file"
            aria-selected={active === file.id}
            tabIndex={active === file.id ? 0 : -1}
            onClick={() => change(file.id)}
          >
            {file.label}
            <small>{file.format}</small>
          </button>
        ))}
      </div>
      <div
        id="publish-file"
        className="pp-file"
        role="tabpanel"
        aria-labelledby={`publish-tab-${selected.id}`}
        tabIndex={0}
      >
        <div className="pp-file-meta">
          <FileText size={15} />
          <strong>{selected.filename}</strong>
          <span>{selected.content.length.toLocaleString()} characters</span>
        </div>
        <p>{selected.hint}</p>
        {destination && (
          <div className="pp-destination">
            <span>PRODUCT LINK</span>
            <a href={destination} target="_blank" rel="noopener noreferrer">
              {destination}
            </a>
            <button
              onClick={() => copyFile(destination, 'Product link')}
              aria-label="Copy product link"
            >
              <Copy size={13} />
            </button>
          </div>
        )}
        {active === 'email' && (
          <div className="pp-subject">
            <span>SUBJECT</span>
            <strong>{project.kit.emailSubject}</strong>
            <button
              onClick={() => copyFile(project.kit.emailSubject, 'Email subject')}
              aria-label="Copy email subject"
            >
              <Copy size={13} />
            </button>
          </div>
        )}
        <div className="pp-view-toggle" aria-label="File view">
          <button aria-pressed={!showFile} onClick={() => setShowFile(false)}>
            Preview
          </button>
          <button aria-pressed={showFile} onClick={() => setShowFile(true)}>
            File contents
          </button>
          <span>{showFile ? 'Ready to copy or import' : 'Your current edited copy'}</span>
        </div>
        {showFile ? (
          <textarea
            aria-label={`${selected.label} file contents`}
            readOnly
            value={selected.content}
            rows={10}
            spellCheck={false}
          />
        ) : (
          <article
            className={`pp-preview pp-preview-${active}`}
            aria-label={`${selected.label} preview`}
          >
            {active === 'shop' ? (
              <>
                {photo && (
                  <img
                    className="pp-product-photo"
                    src={photo}
                    alt={project.product.name}
                    width={170}
                    height={210}
                  />
                )}
                <div className="pp-preview-copy">
                  <span className="pp-preview-brand">{project.product.brand}</span>
                  <h4>{project.kit.title}</h4>
                  <p>{project.kit.description}</p>
                  <ul>
                    {project.kit.bullets.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  {destination && !project.kit.description.includes(destination) && (
                    <a href={destination} target="_blank" rel="noopener noreferrer">
                      {project.product.cta} <ArrowRight size={13} />
                    </a>
                  )}
                </div>
              </>
            ) : active === 'email' ? (
              <div className="pp-preview-copy">
                <span className="pp-preview-brand">{project.product.brand}</span>
                <h4>{project.kit.emailSubject}</h4>
                <p>{project.kit.emailBody}</p>
                {destination && !project.kit.emailBody.includes(destination) && (
                  <a href={destination} target="_blank" rel="noopener noreferrer">
                    {project.product.cta} <ArrowRight size={13} />
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="pp-social-byline">
                  <span>{project.product.brand.slice(0, 1) || 'S'}</span>
                  <strong>{project.product.brand}</strong>
                  <small>{selected.label} draft</small>
                </div>
                <p>{selected.content}</p>
              </>
            )}
          </article>
        )}
        {!showFile && (
          <p className="pp-preview-note">
            {active === 'shop'
              ? 'Context preview: the product photo stays in your shop and is not embedded in the description file.'
              : active === 'email'
                ? 'Layout preview. Your email tool may render fonts and spacing differently.'
                : 'Text preview. Attach artwork from your complete kit when posting.'}
          </p>
        )}
        <div className="pp-file-actions">
          <button className="btn btn-dark" onClick={() => copyFile()}>
            <Copy size={14} /> Copy {selected.format}
          </button>
          <button
            className="btn btn-light"
            onClick={() => {
              download(
                new Blob([selected.content], {
                  type:
                    selected.format === 'HTML'
                      ? 'text/html;charset=utf-8'
                      : 'text/plain;charset=utf-8',
                }),
                selected.filename,
              );
              setNotice(`${selected.filename} downloaded.`);
            }}
          >
            <Download size={14} /> Download file
          </button>
          <button onClick={() => onNavigate(active === 'shop' ? 'listing' : 'social')}>
            Edit source copy <ArrowRight size={13} />
          </button>
        </div>
      </div>
      {notice && (
        <p className="pp-notice" role="status">
          <Check size={14} />
          {notice}
        </p>
      )}
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
      <p className="pp-footnote">
        Launch checks highlight missing inputs; they do not independently verify your product.
        StudioShelf does not publish posts or send emails.
      </p>
    </section>
  );
}
