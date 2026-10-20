import unittest
from score_wer import score


class WerTests(unittest.TestCase):
    def test_negation_deletion(self):
        self.assertEqual(score('Saya tidak muntah.', 'saya muntah'), dict(S=0, D=1, I=0, N=3, WER=1/3))

    def test_substitution_and_insertion(self):
        result = score('nyeri kiri', 'nyeri kanan sekarang')
        self.assertEqual(result['S'], 1)
        self.assertEqual(result['I'], 1)
        self.assertEqual(result['WER'], 1)

    def test_empty_output_and_reference(self):
        self.assertEqual(score('nyeri kiri', '')['WER'], 1)
        with self.assertRaises(ValueError):
            score('', 'halusinasi')


if __name__ == '__main__':
    unittest.main()
