import unittest
from parse_utils import normalize_head
from budget_tree import BudgetNode, BudgetTreeUtils


class TestNormalize(unittest.TestCase):
    def test_normalize_no_spaces(self):
        self.assertEqual(normalize_head("ABC"), "ABC")

    def test_normalize_with_spaces(self):
        self.assertEqual(normalize_head("  ABC"), "ABC")

    def test_normalize_total(self):
        self.assertEqual(normalize_head("Total - ABC"), "Total - ABC")
        self.assertEqual(normalize_head("Total-ABC"), "Total - ABC")
        self.assertEqual(normalize_head("Total -ABC"), "Total - ABC")
        self.assertEqual(normalize_head(1.23), 1.23)


class TestBudgetTree(unittest.TestCase):
    def test_get_key_abbrev(self):
        key1 = "Ministry of Defence"
        abbrev = BudgetTreeUtils.get_key_abbrev(key1)
        self.assertEqual(abbrev, "mod")

        key2 = "Ministry of Defence (dept Of TomFoolery)"
        abbrev = BudgetTreeUtils.get_key_abbrev(key2)
        self.assertEqual(abbrev, "moddot")

    def test_struct(self):
        tree = BudgetNode(name="Root Node", total_init=9000)
        tree.add_child("Ministry of Defence", 1)
        tree.add_child("Ministry of Finance", 2000)
        mod_child = tree.get_child("Ministry of Defence")
        mod_child.add_child("Dept of Tomfoolery", 500)

        print(tree)

    def test_ls(self):
        #  tree = BudgetNode(name="Root Node", total_init=9000)
        tree = BudgetNode(name="Root Node", total_init=0)
        tree.add_child_ls(["Root Node", "A", "X"], 2)
        tree.add_child_ls(["Root Node", "A", "X", "P"], 2)
        tree.add_child_ls(["Root Node", "A", "Y"], 3)
        tree.add_child_ls(["Root Node", "B", "Y"], 3)
        print(tree)

        #  df = BudgetTreeUtils.serialize(tree)
        #  print(df)

        #  nodes, edges = BudgetTreeUtils.get_nodes_and_edges(df)
        #  print(nodes)
        #  print(edges)


if __name__ == "__main__":
    unittest.main()
