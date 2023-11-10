from bs4 import BeautifulSoup
import requests
from urllib import request
import glob
import os
import re
import json

import osmium
import simplekml
import shapely
from shapely import geometry, ops


class JobManager:
    QUEUE_FNAME = "queue.json"
    COMPLETED_FNAME = "completed.json"

    def __init__(self):
        self._queue = self._fetch_file(self.QUEUE_FNAME, {})
        self._completed = self._fetch_file(self.COMPLETED_FNAME, {})
        self.filter_already_completed()

    def filter_already_completed(self):
        keys_completed = set(self._completed.keys())
        keys_queued = set(self._queue.keys())
        keys_requeued = keys_queued - keys_completed
        if len(keys_queued) > 0:
            print(f"Filtering {len(keys_requeued)} already completed jobs")
            for k in keys_requeued:
                del self._queue[k]

    def __del__(self):
        self._save_file(self.QUEUE_FNAME, self._queue)
        self._save_file(self.COMPLETED_FNAME, self._completed)

    @classmethod
    def _fetch_file(cls, fname: str, default_obj) -> dict:
        if os.path.exists(fname):
            return json.load(open(fname))
        else:
            return default_obj

    @classmethod
    def _save_file(cls, fname: str, obj: dict) -> None:
        open(fname, "w").write(json.dumps(obj, indent=4))

    def enqueue(self, job_id: int, name: str):
        self._queue[job_id] = name.strip()

    def mark_as_completed(self, job_id: int):
        self._completed[job_id] = self._queue[job_id]
        del self._queue[job_id]

    def get_pending_jobs(self):
        return dict(self._queue)


def add_coords_to_kml(kml, coords, name):
    if type(coords) == shapely.geometry.linestring.LineString:
        kml.newlinestring(name=name, coords=coords.coords)
    elif type(coords) == shapely.geometry.multilinestring.MultiLineString:
        for lidx, line in enumerate(coords.geoms):
            kml.newlinestring(name=f"{name} {lidx}", coords=line.coords)
    else:
        print("Unknown type: coords")
        print(coords)


class HighwayHandler(osmium.SimpleHandler):
    def __init__(self):
        super(HighwayHandler, self).__init__()
        self.way_coords = {}
        self.node_coords = {}
        self.relation_coords = []
        self.relation_name = None

    def node(self, n):
        self.node_coords[n.id] = (n.location.lon, n.location.lat)

    def way(self, w):
        # self.way_coords[w.id] = [(n.lon, n.lat) for n in w.nodes]
        self.way_coords[w.id] = [self.node_coords[n.ref] for n in w.nodes]

    def relation(self, r):
        if "name" in r.tags:
            self.relation_name = r.tags["name"]

        if "official_name" in r.tags:
            self.relation_name = r.tags["official_name"]

        if "type" in r.tags and r.tags["type"] == "route":
            member_coords = [
                self.way_coords[m.ref]
                for m in r.members
                if m.type == "w" and m.ref in self.way_coords
            ]

            member_lines = [shapely.LineString(m) for m in member_coords]
            multi_line = shapely.MultiLineString(member_lines)
            merged_line = ops.linemerge(multi_line)
            self.relation_coords = merged_line

    def get_relation_coords(self) -> list:
        return self.relation_coords

    def get_relation_name(self) -> str:
        return self.relation_name


def create_kml(glob_dir, fname, fname_simple):
    glob_pattern = f"{glob_dir}/*.osm"
    osm_files = glob.glob(glob_pattern)

    print(f"Found {len(osm_files)} files")

    kml = simplekml.Kml()
    kml_simple = simplekml.Kml()

    for osm_file in osm_files:
        print(f"Processing {osm_file}")

        handler = HighwayHandler()
        handler.apply_file(osm_file)
        coords = handler.get_relation_coords()
        relation_name = handler.get_relation_name()
        # coords_actual = shapely.LineString(coords)
        if type(coords) == list:
            coords = shapely.MultiLineString(coords)
        coords_actual = coords
        coords_simplified = coords_actual.simplify(0.2)
        # print(coords_actual)
        # print(coords_simplified)
        try:
            print(
                f"Simplified from {len(coords_actual.coords)} to {len(coords_simplified.coords)}"
            )
        except Exception as e:
            pass

        add_coords_to_kml(kml, coords_actual, relation_name)
        add_coords_to_kml(kml_simple, coords_simplified, relation_name)

    kml.save(fname)
    kml_simple.save(fname_simple)


def get_relation_fname(expressway_name: str, relation_id: int) -> str:
    relation_name = expressway_name.strip()
    relation_name = re.sub(r"\(.*\)", " ", relation_name).strip()
    relation_name = re.sub(r"Expressway.*", "Expressway", relation_name).strip()
    relation_fname = relation_name.lower().replace(" ", "_")

    fname = f"{relation_fname}_{relation_id}.osm"
    return fname


def fetch_relation_from_overpass(relation_id: int, relation_fname: str) -> None:
    overpass_url = "http://overpass-api.de/api/interpreter"
    query = f"""
    [out:xml];
    relation({relation_id});
    (._;>>;);
    out;
    """
    query
    response = requests.get(overpass_url, params={"data": query})
    response.text
    relation_data = response.text  # This will contain the OSM XML data
    with open(relation_fname, "wb") as f:
        f.write(relation_data.encode("utf-8"))


def run_fetch_jobs(output_dir: str):
    job_manager = JobManager()

    pending_jobs = job_manager.get_pending_jobs()
    for job_id, job_name in pending_jobs.items():
        job_fname = f"{output_dir}/{job_id}.osm"
        try:
            fetch_relation_from_overpass(job_id, job_fname)
            job_manager.mark_as_completed(job_id)
        except Exception as e:
            print(f"Failed to fetch {job_id} {job_name}")


def parse_table():
    job_manager = JobManager()

    table_url = "https://wiki.openstreetmap.org/wiki/India/Expressways"
    req = request.Request(table_url)
    resp = request.urlopen(req)
    data = resp.read()
    soup = BeautifulSoup(data, "html.parser")
    table = soup.find("table", {"class": "wikitable sortable"})
    rows = table.find_all("tr")[1:]

    for row in rows:
        anchor_tags = row.find_all("a", {"class": "external text"})
        if len(anchor_tags) == 0:
            continue

        anchor_tag = anchor_tags[0]
        relation_id = anchor_tag.text

        expressway_name = row.find_all("td")[3].text
        job_manager.enqueue(relation_id, expressway_name)
        # relation_fname = get_relation_fname(expressway_name, relation_id)
        # relation_fname = f"{output_dir}/{relation_fname}"

        # try:
        #     fetch_relation_from_overpass(relation_id, relation_fname)
        # except Exception as e:
        #     print(e)


def run_recreate_kml():
    kml_file = "osm_data.kml"
    kml_file_simple = "osm_data_simple.kml"
    output_dir = "osm_data"

    os.makedirs(output_dir, exist_ok=True)
    run_fetch_jobs(output_dir)
    create_kml(output_dir, kml_file, kml_file_simple)


def run():
    # parse_table()
    run_recreate_kml()


if __name__ == "__main__":
    run()
