# -*- coding: utf-8 -*-
"""
소방도면 법령 자동 검토기 (시제품 v0.1)
제작: 김재환 (소방안전관리자 1급, 소방설비기사 전기)

PDF 소방 평면도에서 범례 기호를 자동으로 잘라 도면 전체에서 같은 기호를 찾고,
축척으로 실제 거리·면적을 계산해 화재안전기술기준(NFTC) 수치 기준과 비교한다.

사용 예)
  python fire_drawing_checker.py 도면.pdf --page 4 --scale 200 --height 6 --use 공장 --fireproof
결과: <출력폴더>/report.html, annotated.png, result.json
"""
import argparse, json, os, re, sys, math, datetime
import numpy as np
import cv2
import pymupdf
from scipy import ndimage

DPI = 200

# ---------------------------------------------------------------- 법령 기준표
# NFTC 101(소화기구) 표 2.1.1.2 : 소화기구 능력단위 1단위당 바닥면적(㎡). 주요구조부 내화+내장 불연·준불연·난연이면 2배.
EXT_AREA_PER_UNIT = {
    "위락시설": 30,
    "공연장": 50, "집회장": 50, "관람장": 50, "문화재": 50, "장례시설": 50, "의료시설": 50,
    "근린생활시설": 100, "판매시설": 100, "운수시설": 100, "숙박시설": 100, "노유자시설": 100,
    "전시장": 100, "공동주택": 100, "업무시설": 100, "방송통신시설": 100, "공장": 100,
    "창고시설": 100, "창고": 100, "항공기및자동차관련시설": 100, "관광휴게시설": 100,
    "그밖의것": 200,
}
# NFTC 203 표 2.4.3.10.1(연기감지기) : 1개당 바닥면적(㎡)
SMOKE_AREA = [  # (부착높이 미만, {종별: 면적})
    (4.0, {"1종": 150, "2종": 150, "3종": 50}),
    (20.0, {"1종": 75, "2종": 75}),
]
# NFTC 203 표 2.4.3.5(스포트형 열감지기) : (부착높이 미만, 내화여부) -> {종류: 면적}
HEAT_AREA = {
    (4.0, True):  {"차동1종": 90, "차동2종": 70, "정온특종": 70, "정온1종": 60, "정온2종": 20},
    (4.0, False): {"차동1종": 50, "차동2종": 40, "정온특종": 40, "정온1종": 30, "정온2종": 15},
    (8.0, True):  {"차동1종": 45, "차동2종": 35, "정온특종": 35, "정온1종": 30},
    (8.0, False): {"차동1종": 30, "차동2종": 25, "정온특종": 25, "정온1종": 15},
}
RULES = {
    "발신기_수평거리_m": 25,      # NFTC 203 2.8(발신기): 층의 각 부분에서 수평거리 25m 이하
    "소형소화기_보행거리_m": 20,  # NFTC 101 2.1.1.4.2: 소형소화기 보행거리 20m 이내
    "대형소화기_보행거리_m": 30,  # NFTC 101 2.1.1.4.2: 대형소화기 보행거리 30m 이내
}

# 범례 이름 → (기호 종류, 세부) 자동 분류
def classify(label):
    s = label.replace(" ", "")
    if "발신기" in s: return ("발신기", None)
    if "소화기" in s:
        m = re.search(r"(\d+)단위", s)
        return ("소화기", int(m.group(1)) if m else None)
    if "연기" in s and "감지기" in s:
        m = re.search(r"([123])종", s); return ("연기감지기", (m.group(1) + "종") if m else "2종")
    if "차동" in s and "감지기" in s:
        m = re.search(r"([12])종", s); return ("열감지기", "차동" + ((m.group(1) + "종") if m else "2종"))
    if "정온" in s and "감지기" in s:
        m = re.search(r"(특|[12])종", s); return ("열감지기", "정온" + ((m.group(1) + "종") if m else "1종"))
    if "수신기" in s or "수신반" in s: return ("수신기", None)
    if "유도등" in s: return ("유도등", s)
    return (None, None)


def render(page):
    zoom = DPI / 72.0
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4: img = img[:, :, :3]
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR), zoom


def legend_entries(page, gray, zoom, plan_box=None):
    """범례표의 글자 줄을 찾아, 같은 줄 왼쪽 칸의 기호를 템플릿으로 잘라낸다."""
    H, W = gray.shape
    dark = gray < 160
    out = []
    mat = page.rotation_matrix * pymupdf.Matrix(zoom, zoom)
    seen = set()
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            txt = "".join(sp["text"] for sp in ln["spans"]).strip()
            kind, sub = classify(txt)
            if not kind or txt in seen or len(txt) > 30: continue
            r = pymupdf.Rect(ln["bbox"]) * mat
            x0, y0, x1, y1 = int(r.x0), int(r.y0), int(r.x1), int(r.y1)
            cy = (y0 + y1) // 2
            # 줄의 위·아래 가로선(표 칸) 찾기
            col = dark[:, max(0, x0 - 5)]
            up = cy
            while up > 0 and not dark[up, max(0, x0 - 40):x0].mean() > 0.9: up -= 1
            dn = cy
            while dn < H - 1 and not dark[dn, max(0, x0 - 40):x0].mean() > 0.9: dn += 1
            if dn - up < 8 or dn - up > 120: continue
            band = dark[up + 3:dn - 2, :x0]
            colsum = band.mean(axis=0)
            divs = [x for x in range(x0 - 1, 0, -1) if colsum[x] > 0.85]
            if not divs: continue
            d1 = divs[0]
            d0 = next((x for x in divs if x < d1 - 10), None)
            if d0 is None: continue
            sub_img = dark[up + 3:dn - 2, d0 + 3:d1 - 2]
            ys, xs = np.nonzero(sub_img)
            if len(xs) < 5: continue
            tx0, tx1, ty0, ty1 = xs.min(), xs.max(), ys.min(), ys.max()
            tpl = gray[up + 3 + ty0 - 2: up + 3 + ty1 + 3, d0 + 3 + tx0 - 2: d0 + 3 + tx1 + 3]
            seen.add(txt)
            out.append({"label": txt, "kind": kind, "sub": sub, "tpl": tpl,
                        "legend_box": (d0, up, x1, dn)})
    return out


def find_symbols(gray, tpl, exclude_boxes, thr=0.66):
    """범례 기호는 평면도 기호보다 크게 그려지는 경우가 많고 회전돼 있기도 해서, 크기 0.55~1.3배·4방향으로 맞춰 본다."""
    cand = []
    for rot in range(4):
        t0 = np.rot90(tpl, rot).copy()
        for s in np.arange(0.45, 1.36, 0.05):
            t = cv2.resize(t0, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            th, tw = t.shape
            if th < 8 or tw < 8: continue
            res = cv2.matchTemplate(gray, t, cv2.TM_CCOEFF_NORMED)
            ys, xs = np.where(res >= thr)
            cand += [(float(res[y, x]), x + tw / 2, y + th / 2, max(tw, th)) for y, x in zip(ys, xs)]
    cand.sort(reverse=True)
    pts = []
    for sc, cx, cy, sz in cand:
        if any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in exclude_boxes): continue
        if any((cx - p[0]) ** 2 + (cy - p[1]) ** 2 < (sz * 0.8) ** 2 for p in pts): continue
        pts.append((cx, cy, float(sc)))
    return pts


def building_mask(gray, exclude_boxes, px_per_m):
    """벽선을 굵게 이어 건물 바닥 영역(외곽 안쪽)을 만든다."""
    dark = (gray < 200).astype(np.uint8)
    for b in exclude_boxes:
        dark[int(b[1]):int(b[3]), int(b[0]):int(b[2])] = 0
    k = max(3, int(px_per_m * 1.5))  # 개방(OPEN) 면·출입구 틈을 메움
    closed = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    closed = ndimage.binary_fill_holes(closed).astype(np.uint8)
    closed = cv2.morphologyEx(closed, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))  # 치수선 같은 가는 선 제거
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        a = cv2.contourArea(c)
        if w < px_per_m * 5 or h < px_per_m * 5: continue
        if best is None or a > best[0]: best = (a, c)
    m = np.zeros_like(dark)
    if best is not None: cv2.drawContours(m, [best[1]], -1, 1, -1)
    return m.astype(bool)


def geodesic_dist(mask, seeds, step):
    """건물 영역 안에서만 움직이는 최단 거리(보행거리 근사), 격자 step px."""
    small = mask[::step, ::step]
    dist = np.full(small.shape, np.inf)
    from heapq import heappush, heappop
    h = []
    for (x, y) in seeds:
        i, j = int(y // step), int(x // step)
        if 0 <= i < small.shape[0] and 0 <= j < small.shape[1]:
            dist[i, j] = 0; heappush(h, (0.0, i, j))
    nb = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
    while h:
        d, i, j = heappop(h)
        if d > dist[i, j]: continue
        for di, dj, w in nb:
            a, b = i + di, j + dj
            if 0 <= a < small.shape[0] and 0 <= b < small.shape[1] and small[a, b] and d + w < dist[a, b]:
                dist[a, b] = d + w; heappush(h, (d + w, a, b))
    return dist * step, small


def area_limit(kind, sub, height, fireproof):
    if kind == "연기감지기":
        if sub in ("2종", "3종") and height >= 15: return None  # NFTC 203 표 2.4.1: 15m 이상은 1종만
        if sub == "3종" and height >= 4: return None
        for hmax, tab in SMOKE_AREA:
            if height < hmax: return tab.get(sub)
        return None
    if kind == "열감지기":
        for hmax in (4.0, 8.0):
            if height < hmax: return HEAT_AREA[(hmax, fireproof)].get(sub)
        return None
    return None


def main():
    ap = argparse.ArgumentParser(description="소방도면 법령 자동 검토기")
    ap.add_argument("pdf"); ap.add_argument("--page", type=int, default=1, help="1부터 시작")
    ap.add_argument("--scale", type=float, default=0, help="축척 분모(예: 200). 0이면 도면 글자 '1/200'에서 자동")
    ap.add_argument("--height", type=float, default=None, help="감지기 부착높이(m). 모르면 비워 둠")
    ap.add_argument("--use", default="그밖의것", help="용도(소화기 능력단위 기준표)")
    ap.add_argument("--fireproof", action="store_true", help="주요구조부 내화+내장 불연·준불연·난연")
    ap.add_argument("--out", default="result")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    doc = pymupdf.open(a.pdf); page = doc[a.page - 1]
    img, zoom = render(page)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    H, W = gray.shape
    text = page.get_text()
    scale = a.scale
    if not scale:
        m = re.search(r"축\s*척\s*[:：]?\s*1\s*/\s*(\d+)", text)
        scale = float(m.group(1)) if m else 100.0
    # 종이 1px = 25.4/DPI mm, 실제 = 그 × 축척
    m_per_px = 25.4 / DPI * scale / 1000.0
    px_per_m = 1 / m_per_px

    leg = legend_entries(page, gray, zoom)
    if len(leg) >= 3:  # 범례표 밖(평면도 안 글자)에서 잘못 잡힌 줄 제거
        med = float(np.median([e["legend_box"][0] for e in leg]))
        leg = [e for e in leg if abs(e["legend_box"][0] - med) < 30]
    title_block = (0, int(H * 0.92), W, H)
    excl = [e["legend_box"] for e in leg] + [title_block]
    if leg:
        lx0 = min(e["legend_box"][0] for e in leg); ly0 = min(e["legend_box"][1] for e in leg)
        lx1 = max(e["legend_box"][2] for e in leg); ly1 = max(e["legend_box"][3] for e in leg)
        excl.append((lx0 - 20, ly0 - 200, lx1 + 20, ly1 + 10))
    # 글자(OPEN, 실명, 치수) 자리는 기호 후보에서 뺀다
    mat = page.rotation_matrix * pymupdf.Matrix(zoom, zoom)
    spans = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                if sp["text"].strip():
                    r = pymupdf.Rect(sp["bbox"]) * mat
                    spans.append((r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2, sp["text"].strip()))
    # 범례 기호 칸 안에 들어 있는 글자(예: 소화기 기호 속 '소')는 기호의 일부라 빼지 않는다
    sym_chars = set()
    for e in leg:
        d0, up, _, dn = e["legend_box"]
        for s in spans:
            cx, cy = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
            if d0 <= cx <= d0 + 80 and up <= cy <= dn and len(s[4]) <= 2: sym_chars.add(s[4])
    text_boxes = [s[:4] for s in spans if s[4] not in sym_chars]
    bmask = building_mask(gray, excl, px_per_m)
    near = cv2.dilate(bmask.astype(np.uint8), np.ones((int(px_per_m), int(px_per_m)), np.uint8)).astype(bool)
    found = {}
    for e in leg:
        if e["tpl"].size == 0 or min(e["tpl"].shape) < 6: continue
        # 기호를 지나가는 배선·벽선(기호보다 긴 직선)을 지운 뒤 맞춰 본다
        L = int(max(e["tpl"].shape) * 1.4) + 2
        dk = (gray < 170).astype(np.uint8)
        lines = cv2.morphologyEx(dk, cv2.MORPH_OPEN, np.ones((1, L), np.uint8)) | cv2.morphologyEx(dk, cv2.MORPH_OPEN, np.ones((L, 1), np.uint8))
        clean = np.where(lines > 0, 255, gray).astype(np.uint8)
        pts = find_symbols(clean, e["tpl"], excl + text_boxes, thr=0.6)
        pts = [p for p in pts if near[int(p[1]), int(p[0])]]  # 건물 안(벽 포함)만
        # 점수가 크게 뛰는 자리(진짜/가짜 경계)를 찾아 그 위만 남김, 못 찾으면 0.78
        sc = sorted([p[2] for p in pts], reverse=True)
        cut = 0.78
        gaps = [(sc[i] - sc[i + 1], (sc[i] + sc[i + 1]) / 2) for i in range(len(sc) - 1) if sc[i] >= 0.7]
        if gaps:
            g, mid = max(gaps)
            if g >= 0.06: cut = mid
        pts = [p for p in pts if p[2] >= cut]
        found[e["label"]] = {"kind": e["kind"], "sub": e["sub"], "pts": pts}

    # 서로 다른 기호가 같은 자리를 잡으면 점수 높은 쪽만 남김
    allp = [(p[2], lab, i) for lab, f in found.items() for i, p in enumerate(f["pts"])]
    allp.sort(reverse=True); keep = {lab: [] for lab in found}; taken = []
    for sc, lab, i in allp:
        p = found[lab]["pts"][i]
        if any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < (px_per_m * 0.4) ** 2 for q in taken): continue
        taken.append(p); keep[lab].append(p)
    for lab in found: found[lab]["pts"] = keep[lab]

    # 범례와 모양이 다르게 그려진 기존 설비: 평면도 글자('기존 발신기' 등) 옆에 있다고 보고 추가(추정 표시)
    label_added = []
    for s in spans:
        if s[4] in sym_chars or len(s[4]) > 12: continue
        if any(b[0] <= (s[0] + s[2]) / 2 <= b[2] and b[1] <= (s[1] + s[3]) / 2 <= b[3] for b in excl): continue
        kind, sub = classify(s[4] + ("" if "감지기" in s[4] else ""))
        if kind != "발신기": continue
        cx, cy = s[2] + px_per_m * 0.5, (s[1] + s[3]) / 2
        lab = next((l for l, f in found.items() if f["kind"] == "발신기"), None)
        if lab is None: continue
        if any(math.hypot(cx - p[0], cy - p[1]) < px_per_m * 4 for p in found[lab]["pts"]): continue
        found[lab]["pts"].append((cx, cy, 0.0)); label_added.append(s[4])

    floor_m2 = bmask.sum() * m_per_px ** 2
    vis = img.copy()
    over = vis.copy()
    issues, passes, checks = [], [], []

    def pts_of(kind):
        return [p for f in found.values() if f["kind"] == kind for p in f["pts"]]

    # 1) 발신기 수평거리 25m
    sw = pts_of("발신기")
    if sw:
        R = RULES["발신기_수평거리_m"] * px_per_m
        cov = np.zeros_like(bmask)
        yy, xx = np.mgrid[0:H, 0:W]
        for (x, y, _) in sw:
            cov |= (xx - x) ** 2 + (yy - y) ** 2 <= R * R
            cv2.circle(vis, (int(x), int(y)), int(R), (0, 160, 0), 2)
        miss = bmask & ~cov
        miss_m2 = miss.sum() * m_per_px ** 2
        over[miss] = (0, 0, 255)
        far = max(min(math.hypot(x - sx, y - sy) for sx, sy, _ in sw) for y, x in zip(*np.nonzero(bmask[::8, ::8]))
                  for y, x in [(y * 8, x * 8)]) * m_per_px
        c = {"항목": "발신기 수평거리", "기준": "층 각 부분에서 25m 이하 (NFTC 203 2.8 발신기)",
             "측정": f"발신기 {len(sw)}개, 가장 먼 지점 {far:.1f}m, 25m 밖 면적 {miss_m2:.1f}㎡"}
        (issues if miss_m2 > 1 else passes).append(c)
    else:
        issues.append({"항목": "발신기", "기준": "층마다 설치 (NFTC 203 2.8)", "측정": "도면에서 발신기를 찾지 못함"})

    # 2) 소화기 보행거리 20m(건물 영역 안 최단거리 근사) + 능력단위
    ex = [(p, f["sub"]) for f in found.values() if f["kind"] == "소화기" for p in f["pts"]]
    if ex:
        step = max(2, int(px_per_m * 0.25))
        dist, small = geodesic_dist(bmask, [(p[0], p[1]) for p, _ in ex], step)
        dm = dist * m_per_px
        reach = dm[small & np.isfinite(dm)]
        far = float(reach.max()) if reach.size else 0
        bad = small & (dm > RULES["소형소화기_보행거리_m"])
        bad_m2 = bad.sum() * (step * m_per_px) ** 2
        big = cv2.resize(bad.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)
        over[big & bmask] = (0, 140, 255)
        c = {"항목": "소화기 보행거리", "기준": "소형소화기 보행거리 20m 이내 (NFTC 101 2.1.1.4.2)",
             "측정": f"소화기 {len(ex)}개, 건물 안 최단 이동거리 최대 {far:.1f}m, 20m 넘는 면적 {bad_m2:.1f}㎡ (내부 벽·출입문은 반영 안 한 근사)"}
        (issues if bad_m2 > 1 else passes).append(c)
        per = EXT_AREA_PER_UNIT.get(a.use.replace(" ", ""), 200) * (2 if a.fireproof else 1)
        need = math.ceil(floor_m2 / per)
        have = sum((u or 1) for _, u in ex)
        c = {"항목": "소화기 능력단위", "기준": f"용도 '{a.use}' 1단위당 {per}㎡ (NFTC 101 표 2.1.1.2{', 내화 2배' if a.fireproof else ''})",
             "측정": f"바닥면적(도면 인식) {floor_m2:.0f}㎡ → 필요 {need}단위, 설치 {have}단위"}
        (issues if have < need else passes).append(c)
    else:
        issues.append({"항목": "소화기", "기준": "NFTC 101", "측정": "도면에서 소화기를 찾지 못함"})

    # 3) 감지기 1개당 감지면적 (보로노이: 가장 가까운 감지기 기준으로 바닥을 나눔)
    dets = [(p, f["kind"], f["sub"]) for f in found.values() if f["kind"] in ("연기감지기", "열감지기") for p in f["pts"]]
    if dets:
        step = 4
        sm = bmask[::step, ::step]
        yy, xx = np.nonzero(sm)
        P = np.array([[p[0] / step, p[1] / step] for p, _, _ in dets])
        d2 = (xx[:, None] - P[None, :, 0]) ** 2 + (yy[:, None] - P[None, :, 1]) ** 2
        lab = d2.argmin(axis=1)
        cell_m2 = np.bincount(lab, minlength=len(dets)) * (step * m_per_px) ** 2
        rows = []
        if a.height is None:
            checks.append({"항목": "감지기 감지면적", "기준": "부착높이별 1개당 바닥면적 (NFTC 203 2.4.3)",
                           "측정": f"감지기 {len(dets)}개, 1개가 맡는 면적 {cell_m2.min():.0f}~{cell_m2.max():.0f}㎡. 천장 높이가 도면에 없어 판정 보류 (--height 입력 필요)"})
        else:
            over_n, edge_n, bad_type = 0, 0, 0
            for i, (p, k, s) in enumerate(dets):
                lim = area_limit(k, s, a.height, a.fireproof)
                if lim is None:
                    bad_type += 1; cv2.circle(vis, (int(p[0]), int(p[1])), 25, (0, 0, 255), 4); continue
                if cell_m2[i] > lim * 1.10:  # 도면 인식 오차(처마·벽 두께) 감안 10% 넘어야 위반 의심
                    over_n += 1; cv2.circle(vis, (int(p[0]), int(p[1])), 25, (0, 0, 255), 4)
                elif cell_m2[i] > lim:
                    edge_n += 1; cv2.circle(vis, (int(p[0]), int(p[1])), 25, (0, 140, 255), 4)
            base = {"항목": "감지기 감지면적", "기준": f"부착높이 {a.height}m, {'내화' if a.fireproof else '기타'}구조 기준 1개당 바닥면적 (NFTC 203 표 2.4.3.5, 표 2.4.3.10.1)"}
            msg = f"감지기 {len(dets)}개, 1개가 맡는 면적 {cell_m2.min():.0f}~{cell_m2.max():.0f}㎡ (실 구분 없이 가까운 감지기로 나눈 근사)"
            if bad_type: issues.append({**base, "기준": f"부착높이 {a.height}m에 설치 가능한 감지기 종류 (NFTC 203 표 2.4.1)", "측정": f"높이에 맞지 않는 감지기 {bad_type}개"})
            if over_n: issues.append({**base, "측정": msg + f" → 기준보다 10% 넘게 초과 {over_n}개"})
            if edge_n: checks.append({**base, "측정": msg + f" → 기준 초과 10% 이내 {edge_n}개(실제 치수로 다시 계산 필요)"})
            if not (bad_type or over_n or edge_n): passes.append({**base, "측정": msg})
        if a.height is not None and a.height >= 20:
            issues.append({"항목": "감지기 부착높이", "기준": "20m 이상은 불꽃·광전식(분리형·공기흡입형) 아날로그 방식만 (NFTC 203 2.4.1)", "측정": f"{a.height}m"})

    # 도면 글자 기반 점검(주기 상충)
    alltext = "".join(pg.get_text() for pg in doc)  # 계통도·범례 등 다른 쪽 주기까지 대조
    if re.search(r"기록\s*[장창]?\s*치", alltext) and "기존" in alltext and ("수신반" in alltext or "수신기" in alltext):
        checks.append({"항목": "수신기 기록장치", "기준": "도면 주기와 실제 장비 일치",
                       "측정": "주기에 '기록장치' 요구가 있는데 기존 수신반 재사용으로 표기됨 → 기존 수신반 사양 확인 필요"})

    # 그림
    vis = cv2.addWeighted(over, 0.35, vis, 0.65, 0)
    colors = {"발신기": (0, 160, 0), "소화기": (0, 120, 255), "연기감지기": (255, 0, 0), "열감지기": (200, 0, 200), "수신기": (0, 0, 0), "유도등": (0, 160, 160)}
    for lab, f in found.items():
        for (x, y, s) in f["pts"]:
            cv2.rectangle(vis, (int(x) - 18, int(y) - 18), (int(x) + 18, int(y) + 18), colors.get(f["kind"], (90, 90, 90)), 3)
    cnt = cv2.findContours(bmask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
    cv2.drawContours(vis, cnt, -1, (255, 140, 0), 3)
    cv2.imwrite(os.path.join(a.out, "annotated.png"), vis)

    counts = {lab: len(f["pts"]) for lab, f in found.items()}
    res = {"파일": os.path.basename(a.pdf), "쪽": a.page, "축척": f"1/{int(scale)}", "바닥면적_㎡": round(floor_m2, 1),
           "인식_기호": counts, "글자로_추가한_기호": label_added, "위반_의심": issues, "통과": passes, "확인_필요": checks,
           "검토일": datetime.date.today().isoformat()}
    with open(os.path.join(a.out, "result.json"), "w", encoding="utf-8") as fp:
        json.dump(res, fp, ensure_ascii=False, indent=2)

    def tbl(rows, title, color):
        if not rows: return f"<h2 style='color:{color}'>{title}</h2><p>없음</p>"
        tr = "".join(f"<tr><td>{r['항목']}</td><td>{r['기준']}</td><td>{r['측정']}</td></tr>" for r in rows)
        return f"<h2 style='color:{color}'>{title} ({len(rows)})</h2><table><tr><th>항목</th><th>기준(근거)</th><th>측정 결과</th></tr>{tr}</table>"
    html = f"""<!doctype html><html lang=ko><meta charset=utf-8><title>소방도면 검토 결과</title>
<style>body{{font-family:'Malgun Gothic',sans-serif;max-width:1100px;margin:24px auto;color:#222}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #bbb;padding:6px 8px;font-size:14px;text-align:left;vertical-align:top}}th{{background:#f1f1f1}}img{{width:100%;border:1px solid #ccc}}</style>
<h1>소방도면 법령 자동 검토 결과</h1>
<p>파일: {res['파일']} / {a.page}쪽 / 축척 {res['축척']} / 도면 인식 바닥면적 {floor_m2:.0f}㎡ / 용도 {a.use} / 부착높이 {a.height if a.height is not None else '미입력'}m / 검토일 {res['검토일']}</p>
<p>인식한 기호: {', '.join(f'{k} {v}개' for k, v in counts.items())}{(' / 글자 위치로 추가(추정): ' + ', '.join(label_added)) if label_added else ''}</p>
{tbl(issues, '위반 의심', '#c00')}{tbl(checks, '확인 필요', '#b60')}{tbl(passes, '기준 충족', '#070')}
<h2>표시 도면</h2><p>주황 선: 인식한 건물 영역 / 초록 원: 발신기 25m 범위 / 빨강 칠: 발신기 범위 밖 / 주황 칠: 소화기 보행거리 20m 초과 / 빨강 원: 감지면적 초과 감지기</p>
<img src="annotated.png">
<p style='font-size:12px;color:#666'>제작: 김재환 (소방안전관리자 1급, 소방설비기사 전기). 참고용 자동 검토이며 최종 판단은 화재안전기술기준 원문과 관할 소방서 확인이 필요합니다. 보행거리는 내부 벽·문을 반영하지 않은 근사값입니다.</p></html>"""
    with open(os.path.join(a.out, "report.html"), "w", encoding="utf-8") as fp:
        fp.write(html)
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
