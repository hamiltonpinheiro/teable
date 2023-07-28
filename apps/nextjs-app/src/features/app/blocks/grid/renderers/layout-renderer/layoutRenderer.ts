import { isEqual } from 'lodash';
import { GRID_DEFAULT, ROW_RELATED_REGIONS } from '../../configs';
import { getDropTargetIndex } from '../../hooks';
import { DragRegionType, RegionType, RowControlType, SelectionRegionType } from '../../interface';
import type { IRenderLayerProps } from '../../RenderLayer';
import {
  checkIfColumnActive,
  checkIfRowOrCellActive,
  checkIfRowOrCellSelected,
  calculateMaxRange,
  inRange,
} from '../../utils';
import {
  drawCheckbox,
  drawLine,
  drawMultiLineText,
  drawRect,
  drawRoundPoly,
  drawSingleLineText,
} from '../base-renderer';
import { getCellRenderer } from '../cell-renderer';
import type { ICellDrawerProps, IFieldHeadDrawerProps, IRowHeaderDrawerProps } from './interface';
import { RenderRegion } from './interface';

const spriteIconMap = {
  [RowControlType.Drag]: 'dragIcon',
  [RowControlType.Expand]: 'expandIcon',
};

export const drawCell = (ctx: CanvasRenderingContext2D, props: ICellDrawerProps) => {
  const {
    x,
    y,
    width,
    height,
    fill,
    stroke,
    cell,
    theme,
    rowIndex,
    columnIndex,
    imageManager,
    isActive,
  } = props;
  const { cellLineColor, cellBg } = theme;
  drawRect(ctx, {
    x,
    y,
    width,
    height,
    fill: fill ?? cellBg,
    stroke: stroke ?? cellLineColor,
  });
  const cellRenderer = getCellRenderer(cell.type);
  cellRenderer.draw(cell as never, {
    ctx,
    theme,
    rect: {
      x,
      y,
      width,
      height,
    },
    rowIndex,
    columnIndex,
    imageManager,
    isActive,
  });
};

export const drawCells = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps,
  renderRegion: RenderRegion
  // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
  const {
    coordInstance,
    visibleRegion,
    activeCell,
    mouseState,
    scrollState,
    selectionState,
    rowControls,
    isRowAppendEnable,
    getCellContent,
    theme,
    imageManager,
    spriteManager,
  } = props;
  const {
    startRowIndex,
    stopRowIndex: originStopRowIndex,
    startColumnIndex: originStartColumnIndex,
    stopColumnIndex: originStopColumnIndex,
  } = visibleRegion;
  const {
    rowHeight,
    freezeColumnCount,
    freezeRegionWidth,
    rowInitSize,
    columnInitSize,
    containerWidth,
    containerHeight,
    pureRowCount,
  } = coordInstance;
  if (pureRowCount === 0) return;
  const { isSelecting, type: selectionType } = selectionState;
  const { scrollLeft, scrollTop } = scrollState;
  const isFreezeRegion = renderRegion === RenderRegion.Freeze;
  const { rowIndex: hoverRowIndex, type: hoverRegionType, isOutOfBounds } = mouseState;
  const startColumnIndex = isFreezeRegion ? 0 : Math.max(freezeColumnCount, originStartColumnIndex);
  const stopColumnIndex = isFreezeRegion
    ? Math.max(freezeColumnCount - 1, 0)
    : originStopColumnIndex;
  const stopRowIndex = isRowAppendEnable ? Math.max(0, originStopRowIndex - 1) : originStopRowIndex;
  const {
    fontSizeXS,
    fontSizeSM,
    fontFamily,
    cellBg,
    cellBgHovered,
    cellBgSelected,
    columnHeaderBgSelected,
  } = theme;

  const cellPropsCollection = [];
  const rowHeaderPropsCollection = [];

  for (let columnIndex = startColumnIndex; columnIndex <= stopColumnIndex; columnIndex++) {
    const x = coordInstance.getColumnRelativeOffset(columnIndex, scrollLeft);
    const columnWidth = coordInstance.getColumnWidth(columnIndex);
    const isColumnActive = checkIfColumnActive(selectionState, columnIndex);

    for (let rowIndex = startRowIndex; rowIndex <= stopRowIndex; rowIndex++) {
      const y = coordInstance.getRowOffset(rowIndex) - scrollTop;
      const isHover =
        !isOutOfBounds &&
        !isSelecting &&
        ROW_RELATED_REGIONS.has(hoverRegionType) &&
        rowIndex === hoverRowIndex;
      const { isCellActive, isRowActive } = checkIfRowOrCellActive(
        activeCell,
        rowIndex,
        columnIndex
      );
      const { isRowSelected, isCellSelected } = checkIfRowOrCellSelected(
        selectionState,
        rowIndex,
        columnIndex
      );
      let fill = cellBg;

      if (isCellSelected || isRowSelected) {
        fill = cellBgSelected;
      } else if (isColumnActive) {
        fill = columnHeaderBgSelected;
      } else if (isHover || isRowActive) {
        fill = cellBgHovered;
      }

      if (columnIndex === 0) {
        rowHeaderPropsCollection.push({
          x: 0.5,
          y: y + 0.5,
          width: columnInitSize,
          height: rowHeight,
          displayIndex: String(rowIndex + 1),
          isHover: isHover || isRowActive,
          isChecked: selectionType === SelectionRegionType.Rows && isRowSelected,
          rowControls,
          theme,
          spriteManager,
        });
      }

      if (isCellActive) continue;

      cellPropsCollection.push({
        x: x + 0.5,
        y: y + 0.5,
        width: columnWidth,
        height: rowHeight,
        rowIndex,
        columnIndex,
        cell: getCellContent([columnIndex, rowIndex]),
        imageManager,
        theme,
        fill,
      });
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    isFreezeRegion ? 0 : freezeRegionWidth + 1,
    rowInitSize + 1,
    isFreezeRegion ? freezeRegionWidth + 1 : containerWidth - freezeRegionWidth,
    containerHeight - rowInitSize - 1
  );
  ctx.clip();

  ctx.font = `${fontSizeSM}px ${fontFamily}`;
  cellPropsCollection.forEach((cellProps) => drawCell(ctx, cellProps));

  ctx.font = `${fontSizeXS}px ${fontFamily}`;
  rowHeaderPropsCollection.forEach((rowHeaderProps) => drawRowHeader(ctx, rowHeaderProps));

  ctx.restore();
};

export const drawActiveCell = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  const { coordInstance, activeCell, scrollState, getCellContent, imageManager, theme } = props;
  const { scrollTop, scrollLeft } = scrollState;
  const { freezeColumnCount, freezeRegionWidth, rowInitSize, containerWidth, containerHeight } =
    coordInstance;

  if (activeCell == null) return;
  const { cellLineColorActived, fontSizeSM, fontFamily } = theme;
  const [columnIndex, rowIndex] = activeCell;
  const isFreezeRegion = columnIndex < freezeColumnCount;
  const x = coordInstance.getColumnRelativeOffset(columnIndex, scrollLeft);
  const y = coordInstance.getRowOffset(rowIndex) - scrollTop;
  const width = coordInstance.getColumnWidth(columnIndex);
  const height = coordInstance.getRowHeight(rowIndex);

  ctx.save();
  ctx.beginPath();
  if (!isFreezeRegion) {
    ctx.rect(
      freezeRegionWidth,
      rowInitSize,
      containerWidth - freezeRegionWidth,
      containerHeight - rowInitSize
    );
    ctx.clip();
  }

  ctx.font = `${fontSizeSM}px ${fontFamily}`;

  drawCell(ctx, {
    x: x + 0.5,
    y: y + 0.5,
    width,
    height,
    rowIndex,
    columnIndex,
    cell: getCellContent([columnIndex, rowIndex]),
    stroke: cellLineColorActived,
    isActive: true,
    imageManager,
    theme,
  });

  ctx.restore();
};

export const drawFillHandler = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  const { coordInstance, scrollState, selectionState, isEditing, theme } = props;
  const { isSelecting } = selectionState;
  const { scrollTop, scrollLeft } = scrollState;
  const { freezeColumnCount, freezeRegionWidth, rowInitSize, containerWidth, containerHeight } =
    coordInstance;
  if (isEditing || isSelecting) return;
  const maxRange = calculateMaxRange(selectionState);
  if (maxRange == null) return;

  const [columnIndex, rowIndex] = maxRange;
  const { fillHandlerSize } = GRID_DEFAULT;
  const { cellBg, cellLineColorActived } = theme;
  const isFreezeRegion = columnIndex < freezeColumnCount;
  const x = coordInstance.getColumnRelativeOffset(columnIndex, scrollLeft);
  const y = coordInstance.getRowOffset(rowIndex) - scrollTop;
  const width = coordInstance.getColumnWidth(columnIndex);
  const height = coordInstance.getRowHeight(rowIndex);

  ctx.save();
  ctx.beginPath();
  if (!isFreezeRegion) {
    ctx.rect(
      freezeRegionWidth,
      rowInitSize,
      containerWidth - freezeRegionWidth,
      containerHeight - rowInitSize
    );
    ctx.clip();
  }

  drawRect(ctx, {
    x: x + width - fillHandlerSize / 2 - 0.5,
    y: y + height - fillHandlerSize / 2 - 0.5,
    width: fillHandlerSize,
    height: fillHandlerSize,
    stroke: cellLineColorActived,
    fill: cellBg,
  });

  ctx.restore();
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const drawRowHeader = (ctx: CanvasRenderingContext2D, props: IRowHeaderDrawerProps) => {
  const {
    x,
    y,
    width,
    height,
    displayIndex,
    theme,
    isHover,
    isChecked,
    rowControls,
    spriteManager,
  } = props;
  const {
    cellBg,
    cellBgHovered,
    cellBgSelected,
    cellLineColor,
    rowHeaderTextColor,
    iconSizeXS,
    staticWhite,
    cellLineColorActived,
  } = theme;
  let fill = cellBg;

  if (isChecked) {
    fill = cellBgSelected;
  } else if (isHover) {
    fill = cellBgHovered;
  }

  drawRect(ctx, {
    x,
    y,
    width,
    height,
    stroke: cellLineColor,
    fill,
  });
  const halfSize = iconSizeXS / 2;
  const { rowHeadIconPaddingTop } = GRID_DEFAULT;

  if (isChecked || isHover) {
    const controlSize = width / rowControls.length;
    for (let i = 0; i < rowControls.length; i++) {
      const type = rowControls[i];
      const offsetX = controlSize * (i + 0.5);

      if (type === RowControlType.Checkbox) {
        drawCheckbox(ctx, {
          x: x + offsetX - halfSize,
          y: y + rowHeadIconPaddingTop,
          size: iconSizeXS,
          stroke: isChecked ? staticWhite : rowHeaderTextColor,
          fill: isChecked ? cellLineColorActived : undefined,
          isChecked,
        });
      } else {
        spriteManager.drawSprite(ctx, {
          sprite: spriteIconMap[type],
          variant: 'normal',
          x: x + offsetX - halfSize,
          y: y + rowHeadIconPaddingTop,
          size: iconSizeXS,
          theme,
        });
      }
    }
    return;
  }
  drawSingleLineText(ctx, {
    x: x + width / 2,
    y: y + rowHeadIconPaddingTop + 3,
    text: displayIndex,
    textAlign: 'center',
    fill: rowHeaderTextColor,
  });
};

export const drawColumnHeader = (ctx: CanvasRenderingContext2D, props: IFieldHeadDrawerProps) => {
  const { x, y, width, height, theme, fill, column, hasMenu, spriteManager } = props;
  const { name, icon, hasMenu: hasColumnMenu } = column;
  const { cellLineColor, cellBg, iconBgCommon, columnHeaderNameColor, fontSizeMD, iconSizeXS } =
    theme;
  const { columnHeadPadding, columnHeadMenuSize } = GRID_DEFAULT;
  let maxTextWidth = width - columnHeadPadding * 2 - iconSizeXS;

  drawRect(ctx, {
    x,
    y,
    width,
    height,
    stroke: cellLineColor,
    fill: fill ?? cellBg,
  });
  icon &&
    spriteManager.drawSprite(ctx, {
      sprite: icon,
      variant: 'normal',
      x: x + columnHeadPadding,
      y: y + (height - iconSizeXS) / 2,
      size: iconSizeXS,
      theme,
    });
  if (hasMenu && hasColumnMenu) {
    maxTextWidth = maxTextWidth - columnHeadMenuSize - columnHeadPadding;
    drawRoundPoly(ctx, {
      points: [
        {
          x: x + width - columnHeadPadding - columnHeadMenuSize,
          y: y + height / 2 - columnHeadMenuSize / 4,
        },
        {
          x: x + width - columnHeadPadding,
          y: y + height / 2 - columnHeadMenuSize / 4,
        },
        {
          x: x + width - columnHeadPadding - columnHeadMenuSize / 2,
          y: y + height / 2 + columnHeadMenuSize / 4,
        },
      ],
      radiusAll: 1,
      fill: iconBgCommon,
    });
  }
  drawMultiLineText(ctx, {
    x: x + iconSizeXS + columnHeadPadding + columnHeadPadding / 2,
    y: y + height / 2 + 1,
    text: name,
    maxLines: 1,
    maxWidth: maxTextWidth,
    fill: columnHeaderNameColor,
    fontSize: fontSizeMD,
  });
};

export const drawColumnHeaders = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps,
  renderRegion: RenderRegion
  // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
  const {
    visibleRegion,
    coordInstance,
    columns,
    theme,
    spriteManager,
    dragState,
    mouseState,
    scrollState,
    selectionState,
    rowControls,
    isRowAppendEnable,
    isColumnHeaderMenuVisible,
  } = props;
  const { startColumnIndex: originStartColumnIndex, stopColumnIndex: originStopColumnIndex } =
    visibleRegion;
  const {
    containerWidth,
    freezeRegionWidth,
    rowInitSize,
    columnInitSize,
    freezeColumnCount,
    rowCount,
  } = coordInstance;
  const { scrollLeft } = scrollState;
  const { isDragging } = dragState;
  const { type: selectionType, ranges: selectionRanges } = selectionState;
  const { type: hoverRegionType, columnIndex: hoverColumnIndex } = mouseState;
  const isFreezeRegion = renderRegion === RenderRegion.Freeze;
  const startColumnIndex = isFreezeRegion ? 0 : Math.max(freezeColumnCount, originStartColumnIndex);
  const stopColumnIndex = isFreezeRegion
    ? Math.max(freezeColumnCount - 1, 0)
    : originStopColumnIndex;
  const endRowIndex = isRowAppendEnable ? rowCount - 2 : rowCount - 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    isFreezeRegion ? 0 : freezeRegionWidth + 1,
    0,
    isFreezeRegion ? freezeRegionWidth + 1 : containerWidth - freezeRegionWidth,
    rowInitSize + 1
  );
  ctx.clip();
  const {
    iconSizeXS,
    fontSizeMD,
    fontFamily,
    cellBg,
    columnHeaderBgHovered,
    columnHeaderBgSelected,
    rowHeaderTextColor,
    cellLineColor,
    cellLineColorActived,
    staticWhite,
  } = theme;
  ctx.font = `normal ${fontSizeMD}px ${fontFamily}`;

  for (let columnIndex = startColumnIndex; columnIndex <= stopColumnIndex; columnIndex++) {
    const x = coordInstance.getColumnRelativeOffset(columnIndex, scrollLeft);
    const columnWidth = coordInstance.getColumnWidth(columnIndex);
    const isActive = checkIfColumnActive(selectionState, columnIndex);
    const isHover =
      !isDragging &&
      [RegionType.ColumnHeader, RegionType.ColumnHeaderMenu].includes(hoverRegionType) &&
      hoverColumnIndex === columnIndex;
    let fill = cellBg;

    if (columnIndex === 0) {
      const halfSize = iconSizeXS / 2;
      drawRect(ctx, {
        x: 0.5,
        y: 0.5,
        width: columnInitSize,
        height: rowInitSize,
        fill: cellBg,
        stroke: cellLineColor,
      });

      if (rowControls.includes(RowControlType.Checkbox)) {
        const isChecked =
          selectionType === SelectionRegionType.Rows &&
          isEqual(selectionRanges[0], [0, endRowIndex]);
        drawCheckbox(ctx, {
          x: columnInitSize / 2 - halfSize + 0.5,
          y: rowInitSize / 2 - halfSize + 0.5,
          size: iconSizeXS,
          stroke: isChecked ? staticWhite : rowHeaderTextColor,
          fill: isChecked ? cellLineColorActived : undefined,
          isChecked,
        });
      }
    }

    if (isActive) {
      fill = columnHeaderBgSelected;
    } else if (isHover) {
      fill = columnHeaderBgHovered;
    }

    drawColumnHeader(ctx, {
      x: x + 0.5,
      y: 0.5,
      width: columnWidth,
      height: rowInitSize,
      column: columns[columnIndex],
      fill,
      hasMenu: isColumnHeaderMenuVisible,
      theme,
      spriteManager,
    });
  }

  ctx.restore();
};

export const drawAppendRow = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps,
  renderRegion: RenderRegion
) => {
  const { scrollState, coordInstance, mouseState, theme, isRowAppendEnable } = props;
  if (!isRowAppendEnable) return;

  const { scrollLeft, scrollTop } = scrollState;
  const { type, rowIndex, isOutOfBounds } = mouseState;
  const isFreezeRegion = renderRegion === RenderRegion.Freeze;
  const { totalWidth, freezeRegionWidth, freezeColumnCount, rowCount, columnInitSize } =
    coordInstance;
  const isHover = !isOutOfBounds && type === RegionType.AppendRow && rowIndex === rowCount - 1;
  const x = isFreezeRegion ? 0 : coordInstance.getColumnOffset(freezeColumnCount);
  const y = coordInstance.getRowOffset(rowCount - 1) - scrollTop;
  const width = isFreezeRegion
    ? freezeRegionWidth + 1
    : totalWidth - scrollLeft - freezeRegionWidth;
  const height = coordInstance.getRowHeight(rowCount - 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    isFreezeRegion ? 0 : freezeRegionWidth + 1,
    y,
    isFreezeRegion ? width : totalWidth - scrollLeft - freezeRegionWidth + 1,
    height + 1
  );
  ctx.clip();
  const { iconSizeMD, fontFamily, cellBg, cellBgHovered, cellLineColor, cellTextColor } = theme;
  ctx.font = `normal ${iconSizeMD}px ${fontFamily}`;
  drawRect(ctx, {
    x: x + 0.5,
    y: y + 0.5,
    width,
    height: height,
    fill: isHover ? cellBgHovered : cellBg,
    stroke: cellLineColor,
  });
  if (isFreezeRegion) {
    drawSingleLineText(ctx, {
      x: x + columnInitSize / 2 + 0.5,
      y: y + height / 2 + 0.5,
      text: '+',
      fill: cellTextColor,
      textAlign: 'center',
      verticalAlign: 'middle',
    });
  }
  ctx.restore();
};

export const drawAppendColumn = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  const { coordInstance, theme, mouseState, scrollState, isColumnAppendEnable } = props;
  const { scrollLeft } = scrollState;
  const { totalWidth } = coordInstance;
  const { type: hoverRegionType } = mouseState;

  if (!isColumnAppendEnable) return;

  const { fontFamily, cellBg, cellLineColor, cellTextColor, columnHeaderBgHovered, iconSizeMD } =
    theme;
  const isHover = hoverRegionType === RegionType.AppendColumn;
  const x = totalWidth - scrollLeft;

  drawRect(ctx, {
    x: x + 0.5,
    y: 0.5,
    width: GRID_DEFAULT.columnAppendBtnWidth,
    height: GRID_DEFAULT.columnHeadHeight,
    fill: isHover ? columnHeaderBgHovered : cellBg,
    stroke: cellLineColor,
  });

  const { columnAppendBtnWidth, columnHeadHeight } = GRID_DEFAULT;
  ctx.font = `${iconSizeMD}px ${fontFamily}`;
  drawSingleLineText(ctx, {
    x: x + columnAppendBtnWidth / 2 + 0.5 - 5,
    y: columnHeadHeight / 2 + 0.5,
    text: '+',
    fill: cellTextColor,
    verticalAlign: 'middle',
  });
};

export const drawColumnResizeHandler = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps
) => {
  const { coordInstance, mouseState, scrollState, theme, columnResizeState, isColumnResizable } =
    props;
  const { type: hoverRegionType, columnIndex: hoverColumnIndex, x: hoverX } = mouseState;
  const { columnIndex: resizeColumnIndex } = columnResizeState;
  const isHover = isColumnResizable && hoverRegionType === RegionType.ColumnResizeHandler;
  const isResizing = resizeColumnIndex > -1;

  if (!isHover && !isResizing) return;

  const { columnResizeHandlerBg } = theme;
  const { columnResizeHandlerWidth } = GRID_DEFAULT;
  const { scrollLeft } = scrollState;
  const { rowInitSize, freezeColumnCount } = coordInstance;
  const isFreezeColumn = hoverColumnIndex < freezeColumnCount;
  let x = 0;

  if (isResizing) {
    const columnWidth = coordInstance.getColumnWidth(resizeColumnIndex);
    x = coordInstance.getColumnRelativeOffset(resizeColumnIndex, scrollLeft) + columnWidth;
  } else {
    let startOffsetX = coordInstance.getColumnOffset(hoverColumnIndex);
    startOffsetX = isFreezeColumn ? startOffsetX : startOffsetX - scrollLeft;
    const realColumnIndex = inRange(
      hoverX,
      startOffsetX,
      startOffsetX + columnResizeHandlerWidth / 2
    )
      ? hoverColumnIndex - 1
      : hoverColumnIndex;
    const realColumnWidth = coordInstance.getColumnWidth(realColumnIndex);
    x = coordInstance.getColumnRelativeOffset(realColumnIndex, scrollLeft) + realColumnWidth;
  }
  const paddingTop = 4;

  drawRect(ctx, {
    x: x - columnResizeHandlerWidth / 2 + 0.5,
    y: paddingTop + 0.5,
    width: columnResizeHandlerWidth,
    height: rowInitSize - paddingTop * 2,
    fill: columnResizeHandlerBg,
    radius: 3,
  });
};

export const drawColumnDraggingRegion = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps
) => {
  const { columns, theme, mouseState, scrollState, dragState, coordInstance } = props;
  const { columnDraggingPlaceholderBg, cellLineColorActived } = theme;
  const { type, isDragging, index: draggingColIndex, delta } = dragState;
  const { containerHeight } = coordInstance;
  const { x } = mouseState;
  const { scrollLeft } = scrollState;

  if (!isDragging || type !== DragRegionType.Columns) return;
  drawRect(ctx, {
    x: x - delta,
    y: 0.5,
    width: columns[draggingColIndex].width as number,
    height: containerHeight,
    fill: columnDraggingPlaceholderBg,
  });

  const targetColumnIndex = getDropTargetIndex(coordInstance, mouseState, scrollState, type);
  const finalX = coordInstance.getColumnRelativeOffset(targetColumnIndex, scrollLeft);

  drawLine(ctx, {
    x: finalX + 0.5,
    y: 0.5,
    points: [0, 0, 0, containerHeight],
    stroke: cellLineColorActived,
  });
};

export const drawRowDraggingRegion = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  const { theme, mouseState, scrollState, dragState, coordInstance } = props;
  const { columnDraggingPlaceholderBg, cellLineColorActived } = theme;
  const { type, isDragging, index: draggingRowIndex, delta } = dragState;
  const { containerWidth } = coordInstance;
  const { scrollTop } = scrollState;
  const { y } = mouseState;

  if (!isDragging || type !== DragRegionType.Rows) return;
  drawRect(ctx, {
    x: 0.5,
    y: y - delta,
    width: containerWidth,
    height: coordInstance.getRowHeight(draggingRowIndex),
    fill: columnDraggingPlaceholderBg,
  });

  const targetRowIndex = getDropTargetIndex(coordInstance, mouseState, scrollState, type);
  const offsetY = coordInstance.getRowOffset(targetRowIndex);
  const finalY = offsetY - scrollTop;

  drawLine(ctx, {
    x: 0.5,
    y: finalY + 0.5,
    points: [0, 0, containerWidth, 0],
    stroke: cellLineColorActived,
  });
};

const setVisibleImageRegion = (props: IRenderLayerProps) => {
  const { imageManager, coordInstance, visibleRegion } = props;
  const { startColumnIndex, stopColumnIndex, startRowIndex, stopRowIndex } = visibleRegion;
  const { freezeColumnCount } = coordInstance;
  imageManager?.setWindow(
    {
      x: startColumnIndex,
      y: startRowIndex,
      width: stopColumnIndex - startColumnIndex,
      height: stopRowIndex - startRowIndex,
    },
    freezeColumnCount
  );
};

export const drawFreezeRegionDivider = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps
) => {
  const { theme, coordInstance, scrollState } = props;
  const { cellLineColor } = theme;
  const { scrollLeft } = scrollState;
  const { freezeRegionWidth, containerHeight } = coordInstance;

  if (scrollLeft === 0) return;

  ctx.save();
  ctx.beginPath();

  ctx.shadowColor = cellLineColor;
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 3;
  ctx.strokeStyle = cellLineColor;

  ctx.moveTo(freezeRegionWidth + 0.5, 0);
  ctx.lineTo(freezeRegionWidth + 0.5, containerHeight);
  ctx.stroke();

  ctx.restore();
};

export const drawColumnHeadersRegion = (
  ctx: CanvasRenderingContext2D,
  props: IRenderLayerProps
) => {
  [RenderRegion.Freeze, RenderRegion.Other].forEach((r) => drawColumnHeaders(ctx, props, r));
  drawAppendColumn(ctx, props);
};

export const drawFreezeRegion = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  drawAppendRow(ctx, props, RenderRegion.Freeze);
  drawCells(ctx, props, RenderRegion.Freeze);
  setVisibleImageRegion(props);
};

export const drawOtherRegion = (ctx: CanvasRenderingContext2D, props: IRenderLayerProps) => {
  drawAppendRow(ctx, props, RenderRegion.Other);
  drawCells(ctx, props, RenderRegion.Other);
};

export const drawGrid = (canvas: HTMLCanvasElement, props: IRenderLayerProps) => {
  const { coordInstance } = props;
  const { containerWidth, containerHeight } = coordInstance;
  const pixelRatio = Math.ceil(window.devicePixelRatio ?? 1);
  const width = Math.ceil(containerWidth * pixelRatio);
  const height = Math.ceil(containerHeight * pixelRatio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx == null) return;

  ctx.clearRect(0, 0, width, height);

  ctx.save();

  if (pixelRatio !== 1) {
    ctx.scale(pixelRatio, pixelRatio);
  }

  ctx.beginPath();
  ctx.rect(0, 0, containerWidth, containerHeight);
  ctx.clip();

  drawOtherRegion(ctx, props);

  drawFreezeRegion(ctx, props);

  drawColumnHeadersRegion(ctx, props);

  drawFreezeRegionDivider(ctx, props);

  drawActiveCell(ctx, props);

  // TODO: Grid Filling Functionality Supplement
  // drawFillHandler(ctx, props);

  drawColumnResizeHandler(ctx, props);

  drawRowDraggingRegion(ctx, props);

  drawColumnDraggingRegion(ctx, props);

  ctx.restore();
};