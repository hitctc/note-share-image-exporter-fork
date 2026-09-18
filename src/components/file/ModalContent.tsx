import { type App, type FrontMatterCache, Notice, Platform } from 'obsidian';
import React, {
  useState, useRef, type FC, useEffect, useCallback,
} from 'react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import { isCopiable } from 'src/imageFormatTester';
import { copy, save, saveAll } from '../../utils/capture';
import { hasValidExportWidth, syncUnifiedPadding } from '../../utils/settings';
import L from '../../L';
import Target, { type TargetRef } from '../common/Target';
import FormItems from '../common/form/FormItems';
import { formatAvailable, getAvailableFormats } from 'src/settings';

const getFormSchema = (settings: ISettings, availableFormats: FileFormat[]): FormSchema<ISettings> => [
  {
    label: L.includingFilename(),
    path: 'showFilename',
    type: 'boolean',
  },
  {
    label: L.imageWidth(),
    path: 'width',
    type: 'number',
  },
  {
    label: L.setting.padding.unified(),
    path: 'padding.unified',
    type: 'boolean',
  },
  {
    path: 'padding.top',
    label: settings.padding?.unified !== false ? L.setting.padding.all() : L.setting.padding.top(),
    desc: settings.padding?.unified !== false ? undefined : L.setting.padding.description(),
    type: 'number',
    when: { flag: true, path: 'padding.unified' },
  },
  {
    path: 'padding.top',
    label: L.setting.padding.top(),
    desc: L.setting.padding.description(),
    type: 'number',
    when: (s) => s.padding?.unified === false,
  },
  {
    path: 'padding.right',
    label: L.setting.padding.right(),
    type: 'number',
    when: (s) => s.padding?.unified === false,
  },
  {
    path: 'padding.bottom',
    label: L.setting.padding.bottom(),
    type: 'number',
    when: (s) => s.padding?.unified === false,
  },
  {
    path: 'padding.left',
    label: L.setting.padding.left(),
    type: 'number',
    when: (s) => s.padding?.unified === false,
  },
  {
    path: 'resolutionMode',
    label: L.setting.resolutionMode.label(),
    desc: L.setting.resolutionMode.description(),
    type: 'select',
    options: [
      { text: "1x", value: '1x' },
      { text: "2x", value: '2x' },
      { text: "3x", value: '3x' },
      { text: "4x", value: '4x' },
    ],
  },
  {
    label: L.setting.userInfo.show(),
    path: 'authorInfo.show',
    type: 'boolean',
  },
  {
    label: L.setting.userInfo.name(),
    path: 'authorInfo.name',
    type: 'string',
    when: { flag: true, path: 'authorInfo.show' },
  },
  {
    label: L.setting.userInfo.remark(),
    path: 'authorInfo.remark',
    type: 'string',
    when: { flag: true, path: 'authorInfo.show' },
  },
  {
    label: L.setting.userInfo.avatar.title(),
    path: 'authorInfo.avatar',
    type: 'string',
    when: { flag: true, path: 'authorInfo.show' },
  },
  {
    label: L.setting.userInfo.align(),
    path: 'authorInfo.align',
    type: 'select',
    options: [
      { text: L.setting.userInfo.alignOptions.left(), value: 'left' },
      { text: L.setting.userInfo.alignOptions.center(), value: 'center' },
      { text: L.setting.userInfo.alignOptions.right(), value: 'right' },
    ],
    when: { flag: true, path: 'authorInfo.show' },
  },
  {
    label: L.setting.watermark.enable.label(),
    path: 'watermark.enable',
    type: 'boolean',
  },
  {
    label: L.setting.watermark.type.label(),
    path: 'watermark.type',
    type: 'select',
    options: [
      { text: L.setting.watermark.type.text(), value: 'text' },
      { text: L.setting.watermark.type.image(), value: 'image' },
    ],
    when: { flag: true, path: 'watermark.enable' },
  },
  {
    label: L.setting.watermark.text.content(),
    path: 'watermark.text.content',
    type: 'string',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.text.fontSize(),
    path: 'watermark.text.fontSize',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.text.fontFamily(),
    path: 'watermark.text.fontFamily',
    type: 'string',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.text.color(),
    path: 'watermark.text.color',
    type: 'string',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.opacity(),
    path: 'watermark.opacity',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.rotate(),
    path: 'watermark.rotate',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.x(),
    path: 'watermark.x',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.y(),
    path: 'watermark.y',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.image.src.label(),
    path: 'watermark.image.src',
    type: 'string',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.width(),
    path: 'watermark.width',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.height(),
    path: 'watermark.height',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.opacity(),
    path: 'watermark.opacity',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.rotate(),
    path: 'watermark.rotate',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.x(),
    path: 'watermark.x',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.y(),
    path: 'watermark.y',
    type: 'number',
    when: (s) => s.watermark.enable && s.watermark.type === 'image',
  },
  {
    label: L.setting.assetMark.enable.label(),
    desc: L.setting.assetMark.enable.description(),
    path: 'assetMark.enable',
    type: 'boolean',
  },
  {
    label: L.setting.assetMark.ownerId.label(),
    desc: L.setting.assetMark.ownerId.description(),
    path: 'assetMark.ownerId',
    type: 'string',
    when: { flag: true, path: 'assetMark.enable' },
  },
  {
    path: 'split.mode',
    label: L.setting.split.mode.label(),
    desc: L.setting.split.mode.description(),
    type: 'select',
    options: [
      { text: L.setting.split.mode.none(), value: 'none' },
      { text: L.setting.split.mode.fixed(), value: 'fixed' },
      { text: L.setting.split.mode.hr(), value: 'hr' },
      { text: L.setting.split.mode.auto(), value: 'auto' },
    ],
  },
  {
    path: 'split.height',
    desc: L.setting.split.height.description(),
    label: L.setting.split.height.label(),
    type: 'number',
    when: (settings) => settings.split.mode !== 'none' && settings.split.mode !== 'hr',
  },
  {
    path: 'split.overlap',
    desc: L.setting.split.overlap.description(),
    label: L.setting.split.overlap.label(),
    type: 'number',
    when: (settings) => settings.split.mode === 'fixed',
  },
  {
    label: L.setting.metadata.label(),
    path: 'showMetadata',
    type: 'boolean',
  },
  {
    label: L.setting.format.title(),
    path: 'format',
    type: 'select',
    options: ([
      { text: L.setting.format.png0(), value: 'png0' },
      { text: L.setting.format.png1(), value: 'png1' },
      { text: L.setting.format.jpg(), value: 'jpg' },
      { text: '.webp', value: 'webp' },
      { text: L.setting.format.pdf(), value: 'pdf' },
    ] satisfies Array<{ text: string; value: FileFormat }>).filter(({ value }) => availableFormats.includes(value)),
  },
];

interface Props {
  settings: ISettings;
  app: App;
  markdownEl: HTMLElement;
  frontmatter: FrontMatterCache | undefined;
  metadataMap: Record<string, { type: MetadataType }>;
  title: string;
  modalContentEl: HTMLElement;
}

/**
 * 将内部格式值转换为按钮中展示的格式名称。
 * @param format 当前导出格式
 * @returns 去除 PNG 分辨率后缀并转为大写的格式名称
 */
function getFormatDisplayName(format: FileFormat): string {
  return format.replace(/\d$/, '').toUpperCase();
}

const ModalContent: FC<Props> = ({
  markdownEl, settings, frontmatter, metadataMap, title, app, modalContentEl,
}) => {
  const [formData, setFormData] = useState<ISettings>(settings);
  const [availableFormats, setAvailableFormats] = useState<FileFormat[]>(formatAvailable);

  useEffect(() => {
    let cancelled = false;
    void getAvailableFormats().then((formats) => {
      if (!cancelled) {
        setAvailableFormats([...formats]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = useCallback((newData: ISettings) => {
    setFormData(syncUnifiedPadding(formData, newData));
  }, [formData]);

  const root = useRef<TargetRef>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [mainHeight, setMainHeight] = useState(0);
  const [columnHeight, setColumnHeight] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const previewOutRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateColumnHeight = () => {
      const contentStyles = getComputedStyle(modalContentEl);
      const mainStyles = mainRef.current ? getComputedStyle(mainRef.current) : null;
      const contentPadding = parseFloat(contentStyles.paddingTop) + parseFloat(contentStyles.paddingBottom);
      const mainMargin = mainStyles
        ? parseFloat(mainStyles.marginTop) + parseFloat(mainStyles.marginBottom)
        : 0;
      const height = modalContentEl.clientHeight - contentPadding - mainMargin;

      if (height > 0) {
        setColumnHeight(height);
      }
    };

    updateColumnHeight();
    const observer = new ResizeObserver(updateColumnHeight);
    observer.observe(modalContentEl);

    return () => {
      observer.disconnect();
    };
  }, [modalContentEl]);

  useEffect(() => {
    const updatePreviewHeight = () => {
      const height = previewOutRef.current?.clientHeight ?? 0;
      if (height > 0) {
        setMainHeight(height);
      }
    };

    updatePreviewHeight();
    const observer = new ResizeObserver(updatePreviewHeight);
    if (previewOutRef.current) {
      observer.observe(previewOutRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    const markContentLoaded = () => {
      timeoutId = window.setTimeout(() => {
        setIsLoading(false);
      }, 100);
    };

    // 当 markdownEl 准备好时，更新 loading 状态
    if (markdownEl.instanceOf(HTMLElement) && markdownEl.innerHTML.length > 0) {
      markContentLoaded();
    }

    // 监听内容加载完成事件
    const handleContentLoaded = () => {
      markContentLoaded();
    };

    activeDocument.addEventListener("export-image-content-loaded", handleContentLoaded);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      activeDocument.removeEventListener("export-image-content-loaded", handleContentLoaded);
    };
  }, [markdownEl]);

  const [processing, setProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'copy' | 'save' | 'saveAll' | null>(null);
  const [allowCopy, setAllowCopy] = useState(false);
  const saveButtonLabel = `${Platform.isMobile ? L.saveVault() : L.save()} (${getFormatDisplayName(formData.format)})`;
  const [rootHeight, setRootHeight] = useState(0);
  const [pages, setPages] = useState(1);
  const [scale, setScale] = useState(1);

  const calculateScale = useCallback(() => {
    if (!root.current?.element || !previewOutRef.current) return 1;
    const contentHeight = root.current.element.clientHeight;
    const contentWidth = root.current.element.clientWidth;
    const previewWidth = previewOutRef.current.clientWidth;
    const previewHeight = mainHeight || previewOutRef.current.clientHeight;

    return Math.min(
      1,
      previewHeight / (contentHeight || 100),
      previewWidth / ((contentWidth || 0) + 2),
    );
  }, [mainHeight]);

  /**
   * 将预览恢复到当前容器能完整显示图片的比例并重新居中。
   * @returns 无返回值；通过预览组件实例更新缩放和位置
   */
  const resetPreview = useCallback(() => {
    if (!transformRef.current) return;

    const nextScale = calculateScale();
    setFitScale(nextScale);
    setScale(nextScale);
    transformRef.current.centerView(nextScale, 160);
  }, [calculateScale]);

  useEffect(() => {
    if (!root.current?.element || processing) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (root.current?.element) {
        if (!processing) {
          setRootHeight(root.current.element.clientHeight);
        }
      }
    });
    observer.observe(root.current.element);
    return () => {
      observer.disconnect();
    };
  }, [root.current?.element, processing]);

  const handleSplitChange = useCallback((positions: number[]) => {
    setPages(positions.length + 1);
  }, []);

  useEffect(() => {
    if (formData.split.mode === 'none') {
      setPages(1);
    }
  }, [formData.split.mode]);

  useEffect(() => {
    setAllowCopy(false);
    void isCopiable(formData.format)
      .then(result => {
        setAllowCopy(Boolean(result));
      })
      .catch(() => {
        setAllowCopy(false);
      });
  }, [formData.format]);

  const handleSave = useCallback(async () => {
    if (!hasValidExportWidth(formData)) {
      new Notice(L.invalidWidth());
      return;
    }
    if (!root.current) return;

    setProcessing(true);
    setProcessingAction('save');
    try {
      await save(
        app,
        root.current.contentElement,
        title,
        formData.resolutionMode,
        formData.format,
        Platform.isMobile,
        formData.assetMark,
      );
    } catch {
      new Notice(L.saveFail());
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  }, [root, formData.resolutionMode, formData.format, title, formData.width]);
  const handleCopy = useCallback(async () => {
    if (!hasValidExportWidth(formData)) {
      new Notice(L.invalidWidth());
      return;
    }
    if (!root.current) return;

    setProcessing(true);
    setProcessingAction('copy');
    try {
      await copy(root.current.contentElement, formData.resolutionMode, formData.format, formData.assetMark);
    } catch {
      new Notice(L.copyFail());
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  }, [root, formData.resolutionMode, formData.format, title, formData.width]);

  const handleSaveAll = useCallback(async () => {
    if (!hasValidExportWidth(formData)) {
      new Notice(L.invalidWidth());
      return;
    }
    if (!root.current) return;

    setProcessing(true);
    setProcessingAction('saveAll');
    try {
      await saveAll(
        root.current,
        formData.format,
        formData.resolutionMode,
        formData.split.height,
        formData.split.overlap,
        formData.split.mode,
        app,
        title,
        formData.assetMark,
      );
    } catch {
      new Notice(L.saveFail());
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  }, [root, formData.format, formData.resolutionMode, formData.split, app, title]);

  return (
    <div className='export-image-preview-root export-image-file-preview-root'>
      <div
        ref={mainRef}
        className='export-image-preview-main export-image-file-preview-main'
        style={{ height: columnHeight }}
      >
        <div
          className='export-image-preview-left'
          style={{ height: columnHeight }}
        >
          <div
            className='export-image-preview-out'
            ref={previewOutRef}
            style={{
              cursor: isGrabbing ? 'grabbing' : 'grab',
            }}
          >
            {isLoading ? (
              <div className="export-image-loading">
                <div className="export-image-loading-spinner"></div>
                <div className="export-image-loading-text">{L.loading()}</div>
              </div>
            ) : (
              <TransformWrapper
                ref={transformRef}
                // 先允许缩放到较小比例，再在组件初始化后按容器尺寸适配完整预览。
                minScale={0.01}
                maxScale={4}
                wheel={{ smoothStep: 0.0015 }}
                panning={{ velocityDisabled: true }}
                doubleClick={{ disabled: true }}
                centerZoomedOut={false}
                onPanning={() => {
                  setIsGrabbing(true);
                }}
                onPanningStop={() => {
                  setIsGrabbing(false);
                }}
                onInit={(previewRef) => {
                  // 此时 Target 已挂载，可以测量真实长宽并让长边完整显示。
                  window.requestAnimationFrame(() => {
                    const nextScale = calculateScale();
                    setFitScale(nextScale);
                    previewRef.centerView(nextScale, 0);
                    setScale(nextScale);
                  });
                }}
                onTransformed={(e) => {
                  setScale(e.state.scale);
                }}
                initialScale={fitScale}
              >
                <TransformComponent
                  wrapperProps={{
                    onDoubleClick: resetPreview,
                  }}
                  wrapperStyle={{
                    width: '100%',
                    height: '100%',
                  }}
                  contentStyle={{
                    border: '1px var(--divider-color) solid',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 0 10px 10px rgba(0,0,0,0.15)',
                  }}
                >
                  <Target
                    ref={root}
                    frontmatter={frontmatter}
                    markdownEl={markdownEl}
                    setting={formData}
                    metadataMap={metadataMap}
                    app={app}
                    title={title}
                    scale={scale}
                    isProcessing={processing}
                    onSplitChange={handleSplitChange}
                  ></Target>
                </TransformComponent>
              </TransformWrapper>
            )}
          </div>
          <div className='info-text'>{L.guide()}</div>
        </div>
        <div
          className='export-image-preview-right export-image-file-preview-right'
          style={{ height: columnHeight }}
        >
          <div className='export-image-file-preview-settings'>
            <FormItems
              formSchema={getFormSchema(formData, availableFormats)}
              update={handleUpdate}
              settings={formData}
              app={app}
            />
            {formData.split.mode !== 'none' && formData.split.mode !== 'hr' && <div className='info-text'>
              {L.splitInfo({ rootHeight, splitHeight: formData.split.height, pages })}
            </div>}
            {formData.split.mode === 'hr' && <div className='info-text'>
              {L.splitInfoHr({ rootHeight, pages })}
            </div>}
            <div className='info-text'>{L.moreSetting()}</div>
          </div>
          <div className='export-image-preview-actions export-image-file-preview-actions'>
            {pages === 1 && (
              <div>
                <button
                  onClick={() => {
                    void handleCopy();
                  }}
                  disabled={processing || !allowCopy || isLoading}
                  aria-busy={processingAction === 'copy'}
                >
                  {processingAction === 'copy' && <span className='export-image-action-spinner' aria-hidden='true'></span>}
                  {L.copy()}
                </button>
                {allowCopy || <p>{L.notAllowCopy({ format: formData.format.replace(/\d$/, '').toUpperCase() })}</p>}
              </div>
            )}

            <button
              onClick={() => {
                void (pages === 1 ? handleSave() : handleSaveAll());
              }}
              disabled={processing || isLoading}
              aria-busy={processingAction === 'save' || processingAction === 'saveAll'}
            >
              {(processingAction === 'save' || processingAction === 'saveAll') && (
                <span className='export-image-action-spinner' aria-hidden='true'></span>
              )}
              {saveButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalContent;
